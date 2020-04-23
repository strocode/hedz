class NullVideoStream(MediaStreamTrack):
    kind = 'video'

    def __init__(self):
        super().__init__()

    async def recv(self):
        return None

class NullAudioStream(MediaStreamTrack):
    kind = 'audio'

    def __init__(self):
        super().__init__()

    async def recv(self):
        return None



async def breakit():
    insdp = '''
v=0
o=- 548516979697337927 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0 1 2
a=msid-semantic: WMS BB4M3JZPQpQg5qiMZxoaHPJ2rUCJyWFsfIPf
m=audio 54459 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126
c=IN IP4 220.233.71.88
a=rtcp:9 IN IP4 0.0.0.0
a=candidate:615578986 1 udp 2122262783 2406:3400:218:2470:2d45:de73:278e:7794 57432 typ host generation 0 network-id 2 network-cost 10
a=candidate:1246340737 1 udp 2122194687 192.168.20.14 54459 typ host generation 0 network-id 1 network-cost 10
a=candidate:1781727642 1 tcp 1518283007 2406:3400:218:2470:2d45:de73:278e:7794 9 typ host tcptype active generation 0 network-id 2 network-cost 10
a=candidate:80370289 1 tcp 1518214911 192.168.20.14 9 typ host tcptype active generation 0 network-id 1 network-cost 10
a=candidate:3405881397 1 udp 1685987071 220.233.71.88 54459 typ srflx raddr 192.168.20.14 rport 54459 generation 0 network-id 1 network-cost 10
a=ice-ufrag:aETJ
a=ice-pwd:ew3wObXatFK+L3Hi+rquLlXC
a=ice-options:trickle
a=fingerprint:sha-256 26:54:C2:DB:E7:A8:D1:45:D1:C1:DA:65:94:5E:AC:8C:11:40:04:83:1C:35:88:2F:06:AA:5B:79:19:D1:D2:7C
a=setup:actpass
a=mid:0
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid
a=extmap:5 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id
a=extmap:6 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id
a=sendrecv
a=msid:BB4M3JZPQpQg5qiMZxoaHPJ2rUCJyWFsfIPf 73fea39a-f2dc-4e3b-a6f2-ff6f30f46979
a=rtcp-mux
a=rtpmap:111 opus/48000/2
a=rtcp-fb:111 transport-cc
a=fmtp:111 minptime=10;useinbandfec=1
a=rtpmap:103 ISAC/16000
a=rtpmap:104 ISAC/32000
a=rtpmap:9 G722/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:106 CN/32000
a=rtpmap:105 CN/16000
a=rtpmap:13 CN/8000
a=rtpmap:110 telephone-event/48000
a=rtpmap:112 telephone-event/32000
a=rtpmap:113 telephone-event/16000
a=rtpmap:126 telephone-event/8000
a=ssrc:566882759 cname:fp41BM0Tf7XiRuM+
a=ssrc:566882759 msid:BB4M3JZPQpQg5qiMZxoaHPJ2rUCJyWFsfIPf 73fea39a-f2dc-4e3b-a6f2-ff6f30f46979
a=ssrc:566882759 mslabel:BB4M3JZPQpQg5qiMZxoaHPJ2rUCJyWFsfIPf
a=ssrc:566882759 label:73fea39a-f2dc-4e3b-a6f2-ff6f30f46979
m=video 56412 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 102 122 127 121 125 107 108 109 124 120 123 119 114 115 116
c=IN IP4 220.233.71.88
a=rtcp:9 IN IP4 0.0.0.0
a=candidate:615578986 1 udp 2122262783 2406:3400:218:2470:2d45:de73:278e:7794 54460 typ host generation 0 network-id 2 network-cost 10
a=candidate:1246340737 1 udp 2122194687 192.168.20.14 56412 typ host generation 0 network-id 1 network-cost 10
a=candidate:1781727642 1 tcp 1518283007 2406:3400:218:2470:2d45:de73:278e:7794 9 typ host tcptype active generation 0 network-id 2 network-cost 10
a=candidate:80370289 1 tcp 1518214911 192.168.20.14 9 typ host tcptype active generation 0 network-id 1 network-cost 10
a=candidate:3405881397 1 udp 1685987071 220.233.71.88 56412 typ srflx raddr 192.168.20.14 rport 56412 generation 0 network-id 1 network-cost 10
a=ice-ufrag:aETJ
a=ice-pwd:ew3wObXatFK+L3Hi+rquLlXC
a=ice-options:trickle
a=fingerprint:sha-256 26:54:C2:DB:E7:A8:D1:45:D1:C1:DA:65:94:5E:AC:8C:11:40:04:83:1C:35:88:2F:06:AA:5B:79:19:D1:D2:7C
a=setup:actpass
a=mid:1
a=extmap:14 urn:ietf:params:rtp-hdrext:toffset
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:13 urn:3gpp:video-orientation
a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:12 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay
a=extmap:11 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing
a=extmap:8 http://tools.ietf.org/html/draft-ietf-avtext-framemarking-07
a=extmap:9 http://www.webrtc.org/experiments/rtp-hdrext/color-space
a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid
a=extmap:5 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id
a=extmap:6 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id
a=sendrecv
a=msid:BB4M3JZPQpQg5qiMZxoaHPJ2rUCJyWFsfIPf ee6c5c85-3d65-4761-9e83-82a94b3b3dc0
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:96 VP8/90000
a=rtcp-fb:96 goog-remb
a=rtcp-fb:96 transport-cc
a=rtcp-fb:96 ccm fir
a=rtcp-fb:96 nack
a=rtcp-fb:96 nack pli
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=96
a=rtpmap:98 VP9/90000
a=rtcp-fb:98 goog-remb
a=rtcp-fb:98 transport-cc
a=rtcp-fb:98 ccm fir
a=rtcp-fb:98 nack
a=rtcp-fb:98 nack pli
a=fmtp:98 profile-id=0
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=98
a=rtpmap:100 VP9/90000
a=rtcp-fb:100 goog-remb
a=rtcp-fb:100 transport-cc
a=rtcp-fb:100 ccm fir
a=rtcp-fb:100 nack
a=rtcp-fb:100 nack pli
a=fmtp:100 profile-id=2
a=rtpmap:101 rtx/90000
a=fmtp:101 apt=100
a=rtpmap:102 H264/90000
a=rtcp-fb:102 goog-remb
a=rtcp-fb:102 transport-cc
a=rtcp-fb:102 ccm fir
a=rtcp-fb:102 nack
a=rtcp-fb:102 nack pli
a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f
a=rtpmap:122 rtx/90000
a=fmtp:122 apt=102
a=rtpmap:127 H264/90000
a=rtcp-fb:127 goog-remb
a=rtcp-fb:127 transport-cc
a=rtcp-fb:127 ccm fir
a=rtcp-fb:127 nack
a=rtcp-fb:127 nack pli
a=fmtp:127 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42001f
a=rtpmap:121 rtx/90000
a=fmtp:121 apt=127
a=rtpmap:125 H264/90000
a=rtcp-fb:125 goog-remb
a=rtcp-fb:125 transport-cc
a=rtcp-fb:125 ccm fir
a=rtcp-fb:125 nack
a=rtcp-fb:125 nack pli
a=fmtp:125 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=rtpmap:107 rtx/90000
a=fmtp:107 apt=125
a=rtpmap:108 H264/90000
a=rtcp-fb:108 goog-remb
a=rtcp-fb:108 transport-cc
a=rtcp-fb:108 ccm fir
a=rtcp-fb:108 nack
a=rtcp-fb:108 nack pli
a=fmtp:108 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01f
a=rtpmap:109 rtx/90000
a=fmtp:109 apt=108
a=rtpmap:124 H264/90000
a=rtcp-fb:124 goog-remb
a=rtcp-fb:124 transport-cc
a=rtcp-fb:124 ccm fir
a=rtcp-fb:124 nack
a=rtcp-fb:124 nack pli
a=fmtp:124 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d0032
a=rtpmap:120 rtx/90000
a=fmtp:120 apt=124
a=rtpmap:123 H264/90000
a=rtcp-fb:123 goog-remb
a=rtcp-fb:123 transport-cc
a=rtcp-fb:123 ccm fir
a=rtcp-fb:123 nack
a=rtcp-fb:123 nack pli
a=fmtp:123 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=640032
a=rtpmap:119 rtx/90000
a=fmtp:119 apt=123
a=rtpmap:114 red/90000
a=rtpmap:115 rtx/90000
a=fmtp:115 apt=114
a=rtpmap:116 ulpfec/90000
a=ssrc-group:FID 443377596 358487208
a=ssrc:443377596 cname:fp41BM0Tf7XiRuM+
a=ssrc:443377596 msid:BB4M3JZPQpQg5qiMZxoaHPJ2rUCJyWFsfIPf ee6c5c85-3d65-4761-9e83-82a94b3b3dc0
a=ssrc:443377596 mslabel:BB4M3JZPQpQg5qiMZxoaHPJ2rUCJyWFsfIPf
a=ssrc:443377596 label:ee6c5c85-3d65-4761-9e83-82a94b3b3dc0
a=ssrc:358487208 cname:fp41BM0Tf7XiRuM+
a=ssrc:358487208 msid:BB4M3JZPQpQg5qiMZxoaHPJ2rUCJyWFsfIPf ee6c5c85-3d65-4761-9e83-82a94b3b3dc0
a=ssrc:358487208 mslabel:BB4M3JZPQpQg5qiMZxoaHPJ2rUCJyWFsfIPf
a=ssrc:358487208 label:ee6c5c85-3d65-4761-9e83-82a94b3b3dc0
m=application 55886 UDP/DTLS/SCTP webrtc-datachannel
c=IN IP4 220.233.71.88
a=candidate:615578986 1 udp 2122262783 2406:3400:218:2470:2d45:de73:278e:7794 56413 typ host generation 0 network-id 2 network-cost 10
a=candidate:1246340737 1 udp 2122194687 192.168.20.14 55886 typ host generation 0 network-id 1 network-cost 10
a=candidate:1781727642 1 tcp 1518283007 2406:3400:218:2470:2d45:de73:278e:7794 9 typ host tcptype active generation 0 network-id 2 network-cost 10
a=candidate:80370289 1 tcp 1518214911 192.168.20.14 9 typ host tcptype active generation 0 network-id 1 network-cost 10
a=candidate:3405881397 1 udp 1685987071 220.233.71.88 55886 typ srflx raddr 192.168.20.14 rport 55886 generation 0 network-id 1 network-cost 10
a=ice-ufrag:aETJ
a=ice-pwd:ew3wObXatFK+L3Hi+rquLlXC
a=ice-options:trickle
a=fingerprint:sha-256 26:54:C2:DB:E7:A8:D1:45:D1:C1:DA:65:94:5E:AC:8C:11:40:04:83:1C:35:88:2F:06:AA:5B:79:19:D1:D2:7C
a=setup:actpass
a=mid:2
a=sctp-port:5000
a=max-message-size:262144
'''
    pc = RTCPeerConnection()
    offer = RTCSessionDescription(insdp, type='offer')
    await pc.setRemoteDescription(offer)

    pc.addTrack(NullVideoStream())
    pc.addTrack(NullVideoStream()) # <- This line commented it works OK.
    pc.addTrack(NullAudioStream())
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

