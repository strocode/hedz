import argparse
import asyncio
import json
import logging
import os
import ssl
import uuid

import cv2
from aiohttp import web
from av import VideoFrame

from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaBlackhole, MediaPlayer, MediaRecorder

ROOT = os.path.dirname(__file__)

logger = logging.getLogger("pc")
pcs = set()

NPLAYERS = 2

def pos_filt(fx, fx_last, c=0.3, minmove=6):
    filt = fx_last + (fx - fx_last)*c
    ifilt = int(filt)
    if abs(ifilt - fx_last) < minmove:
        out_fx = fx_last
    else:
        out_fx = ifilt
        

#    print('Filter ', fx, fx_last, c, minmove, filt, ifilt, out_fx)
    return out_fx

def calc_bounds(fx, fw, ow):
    # Extract face
    # face x, y are edge of box. We want to cetner a fixed box on the face
    xmid = fx + fw//2
    xstart = xmid - ow//2
    if xstart < 0:
        xstart = 0
        
    xend = xstart + ow
    return (xstart, xend)
    

class VideoTransformTrack(MediaStreamTrack):
    """
    A video stream track that transforms frames from an another track.
    """

    kind = "video"

    def __init__(self, track, transform):
        super().__init__()  # don't forget this!
        self.track = track
        self.transform = transform
        if self.transform == 'track':
            self.face_cascade = cv2.CascadeClassifier('haarcascade_frontalface_default.xml')
            self.face_last = None
            self.face_out_sz = (640//4, 480//4)
            self.nframes = 0
            self.total_ticks = 0

    async def recv(self):
        frame = await self.track.recv()

        if self.transform == "cartoon":
            img = frame.to_ndarray(format="bgr24")

            # prepare color
            img_color = cv2.pyrDown(cv2.pyrDown(img))
            for _ in range(6):
                img_color = cv2.bilateralFilter(img_color, 9, 9, 7)
            img_color = cv2.pyrUp(cv2.pyrUp(img_color))

            # prepare edges
            img_edges = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            img_edges = cv2.adaptiveThreshold(
                cv2.medianBlur(img_edges, 7),
                255,
                cv2.ADAPTIVE_THRESH_MEAN_C,
                cv2.THRESH_BINARY,
                9,
                2,
            )
            img_edges = cv2.cvtColor(img_edges, cv2.COLOR_GRAY2RGB)

            # combine color and edges
            img = cv2.bitwise_and(img_color, img_edges)

            # rebuild a VideoFrame, preserving timing information
            new_frame = VideoFrame.from_ndarray(img, format="bgr24")
            new_frame.pts = frame.pts
            new_frame.time_base = frame.time_base
            return new_frame
        elif self.transform == "edges":
            # perform edge detection
            img = frame.to_ndarray(format="bgr24")
            img = cv2.cvtColor(cv2.Canny(img, 100, 200), cv2.COLOR_GRAY2BGR)

            # rebuild a VideoFrame, preserving timing information
            new_frame = VideoFrame.from_ndarray(img, format="bgr24")
            new_frame.pts = frame.pts
            new_frame.time_base = frame.time_base
            return new_frame
        elif self.transform == "rotate":
            # rotate image
            img = frame.to_ndarray(format="bgr24")
            rows, cols, _ = img.shape
            M = cv2.getRotationMatrix2D((cols / 2, rows / 2), frame.time * 45, 1)
            img = cv2.warpAffine(img, M, (cols, rows))

            # rebuild a VideoFrame, preserving timing information
            new_frame = VideoFrame.from_ndarray(img, format="bgr24")
            new_frame.pts = frame.pts
            new_frame.time_base = frame.time_base
            return new_frame
        elif self.transform == "track":
            oldframe = frame
            frameh = frame.height
            framew = frame.width
            frame = oldframe.to_ndarray(format='bgr24')
            # Our operations on the frame come here
            scale = 2
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            #gray = cv2.resize(frame, (framew//scale, frameh//scale))
            
            e1 = cv2.getTickCount()
            faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
            e2 = cv2.getTickCount()
            #total_ticks += (e2 - e1)
            self.nframes += 1
            self.total_ticks += (e2 - e1)
            
            if self.nframes % 100 == 0:
                nsec = float(self.total_ticks)/cv2.getTickFrequency()
                print("Face cascade takes for %d frames is %f frame/sec"%( self.nframes, float(self.nframes)/float(nsec)))

            # Extract first face
            ow, oh = self.face_out_sz
            if len(faces) == 0:
                if self.face_last is None:
                    # Pick center of the image
                    face = (framew - ow, framey - oh, ow, oh)
                else:
                    face = self.face_last
            else:
                face = faces[0] # pick first face


            fx, fy, fw, fh = face
            if self.face_last != None: # filter positions a bit. They're noisy
                fx_last = self.face_last[0]
                fy_last = self.face_last[1]
                fx = pos_filt(fx, fx_last)
                fy = pos_filt(fy, fy_last)


            xstart, xend = calc_bounds(fx, fw, ow)
            ystart, yend = calc_bounds(fy, fh, oh)
            
            newimg = frame[ystart:yend, xstart:xend, :]
            # rebuild a VideoFrame, preserving timing information
            new_frame = VideoFrame.from_ndarray(newimg, format="bgr24")
            new_frame.pts = oldframe.pts
            new_frame.time_base = oldframe.time_base

            # save last face
            self.face_last = (fx, fy, fw, fh)

            return new_frame
        else:
            return frame

class FrameQueueTrack(MediaStreamTrack):
    kind = 'video'
    
    def __init__(self, maxsize=0):
        super().__init__()  # don't forget this!
        self.queue = asyncio.Queue(maxsize)

    async def recv(self):
        frame = await self.queue.get()
        self.queue.task_done()
        print('Queue reutrning frame', frame)
        return frame

    async def put(self, frame):
        await self.queue.put(frame)

class TrackSplitter:
    def __init__(self, media_stream):
        self.media_stream = media_stream
        self.output_tracks = []
        self.task = asyncio.create_task(self.push_coro())

    async def push_coro(self):
        while True:
            frame = await self.media_stream.recv()
            print('Got frame', frame, 'pushing onto', len(self.output_tracks), 'tracks')
            for ot in self.output_tracks:
                await ot.put(frame)
                print('Queuesize is ', ot.queue.qsize())

    def add_output(self, track):
        self.output_tracks.append(track)

    def add_client(self, clientid, client):
        fqueue = FrameQueueTrack()
        self.add_output(fqueue)
        client.add_output_track(fqueue)

class Client:
    def __init__(self, mgr, theirid):
        self.__mgr = mgr
        self.pc = RTCPeerConnection()
        self.theirid = theirid
        self.myid = uuid.uuid4()

    def add_input_track(self, track):
        self.__mgr.add_track(self.theirid, track)

    def add_output_track(self, track):
        self.pc.addTrack(track)

class ConnectionManager:
    def __init__(self, nclients=2):
        self.clients = {} # Map from client ID to ClientId
        self.their_clients = {} # mapt from theirid to Client
        if nclients is not None:
            for i in range(nclients):
                self.__create_client(i)

        self.__curr_client = 0

    def __create_client(self, clientid):
        c = Client(self, clientid)
        self.clients[clientid] = c
        return c

    def add_client(self, theirid=None):
        if theirid is None:
            theirid = uuid.uuid4()
            
        c = self.clients[self.__curr_client]
        self.__curr_client += 1
        c.theirid = theirid
        self.their_clients[c.theirid] = c
        return c

    def add_track(self, clientid, track):
        pc = self.their_clients[clientid]
        if track.kind == 'video':
            input_track = VideoTransformTrack(track, transform='track')
            input_splitter = TrackSplitter(input_track)
            for cid, client_conn in self.clients.items():
                input_splitter.add_client(cid, client_conn)

conn_mgr = ConnectionManager()
                

async def index(request):
    content = open(os.path.join(ROOT, "index.html"), "r").read()
    return web.Response(content_type="text/html", text=content)


async def javascript(request):
    content = open(os.path.join(ROOT, "client.js"), "r").read()
    return web.Response(content_type="application/javascript", text=content)


async def offer(request):
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    #pc = RTCPeerConnection()
    client = conn_mgr.add_client() # TODO: get client ID from JSON cookie or something
    pc = client.pc
    pc_id = "PeerConnection(%s)" % uuid.uuid4()
    pcs.add(pc)

    def log_info(msg, *args):
        logger.info(pc_id + " " + msg, *args)

    log_info("Created for %s", request.remote)

    # prepare local media
    player = MediaPlayer(os.path.join(ROOT, "demo-instruct.wav"))
    if args.write_audio:
        recorder = MediaRecorder(args.write_audio)
    else:
        recorder = MediaBlackhole()

    @pc.on("datachannel")
    def on_datachannel(channel):
        @channel.on("message")
        def on_message(message):
            if isinstance(message, str) and message.startswith("ping"):
                channel.send("pong" + message[4:])

    @pc.on("iceconnectionstatechange")
    async def on_iceconnectionstatechange():
        log_info("ICE connection state is %s", pc.iceConnectionState)
        if pc.iceConnectionState == "failed":
            await pc.close()
            pcs.discard(pc)

    @pc.on("track")
    def on_track(track):
        log_info("Track %s received", track.kind)

        if track.kind == "audio":
            pc.addTrack(player.audio)
            recorder.addTrack(track)
        elif track.kind == "video":
            #local_video = VideoTransformTrack(
            #    track, transform=params["video_transform"]
            #)
            #pc.addTrack(local_video)
            client.add_input_track(track)

        @track.on("ended")
        async def on_ended():
            log_info("Track %s ended", track.kind)
            await recorder.stop()

    # handle offer
    await pc.setRemoteDescription(offer)
    await recorder.start()

    # send answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.Response(
        content_type="application/json",
        text=json.dumps(
            {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
        ),
    )


async def on_shutdown(app):
    # close peer connections
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="WebRTC audio / video / data-channels demo"
    )
    parser.add_argument("--cert-file", help="SSL certificate file (for HTTPS)")
    parser.add_argument("--key-file", help="SSL key file (for HTTPS)")
    parser.add_argument(
        "--port", type=int, default=8080, help="Port for HTTP server (default: 8080)"
    )
    parser.add_argument("--verbose", "-v", action="count")
    parser.add_argument("--write-audio", help="Write received audio to a file")
    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    if args.cert_file:
        ssl_context = ssl.SSLContext()
        ssl_context.load_cert_chain(args.cert_file, args.key_file)
    else:
        ssl_context = None

    app = web.Application()
    app.on_shutdown.append(on_shutdown)
    app.router.add_get("/", index)
    app.router.add_get("/client.js", javascript)
    app.router.add_post("/offer", offer)
    web.run_app(app, access_log=None, port=args.port, ssl_context=ssl_context)
