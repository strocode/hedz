const video = document.getElementById('video')

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
  faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
  faceapi.nets.faceExpressionNet.loadFromUri('/models')
]).then(startVideo)

function startVideo() {
    const constraints = {
	video: {
	    width: 640,
	    height: 480
	}
    };

    navigator.mediaDevices.getUserMedia(constraints)
	.then(function(stream) {
	  video.srcObject = stream;
	});

}

var resizedDetections = [];
var detections = [];

video.addEventListener('play', () => {
  const canvas = faceapi.createCanvasFromMedia(video)
  document.body.append(canvas)
  const displaySize = { width: video.width, height: video.height }
  faceapi.matchDimensions(canvas, displaySize)
  setInterval(async () => {
      detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions()
      //const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());

      resizedDetections = faceapi.resizeResults(detections, displaySize)
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      faceapi.draw.drawDetections(canvas, resizedDetections)
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
      faceapi.draw.drawFaceExpressions(canvas, resizedDetections)

      if (resizedDetections.length >= 1) {
	  var det = resizedDetections[0];
	  var box = det.detection.box;
	  ctx.strokeStyle = 'green';
	  ctx.strokeRect(box.x, box.y, box.width, box.height);
      }
  }, 100)
})

var last_rect = {}

function copyCutout() {
    var cutcanvas = document.getElementById('cutout');
    var ctx = cutcanvas.getContext('2d');
    var video = document.getElementById('video');
    // rescaledDetections has weird offsets - don't understand why but
    // Just don't use them and eeeevrything will be fiiiiine
    if (detections.length == 1) {
	var det = detections[0];
	var box = det.detection.box;

	var detw = box.width;
	var deth = box.height;
	var detx = box.x;
	var dety = box.y;

	// middle of the box
	var mx = detx + detw/2;
	var my = dety + deth/2;

	var extra_height = 0.0;
	var extra_height_pix = extra_height*deth;
	deth = deth + extra_height_pix;
	dety = dety - extra_height_pix;


	// source width and height
	var sw = detw;
	var sh = deth;

	// Possition of the larger box
	//var sx = mx - w/2;
	//var sy = my - h/2;

	var sx = detx;
	var sy = dety;

	var dw = detw;
	var dh = deth;

	dw = 256;
	dh = dw;
	sh = detw;
	sw = deth;
	sx = detx;
	sy = dety;


	cutcanvas.width = dw;
	cutcanvas.height = dh;

	// Destination x and y = 0,0 for top left of the box
	var dx = 0;
	var dy = 0;
	last_rect = {sx:sx, sy:sy, sw:sw, sh:sh, dx:dx, dy:dy, dw:dw, dh:dh};
    }
    if (last_rect.sx != undefined) {
	ctx.drawImage(video,
		  last_rect.sx,
		  last_rect.sy,
		  last_rect.sw,
		  last_rect.sh,
		  last_rect.dx,
		  last_rect.dy,
		  last_rect.dw,
		  last_rect.dh);
    }
    window.requestAnimationFrame(copyCutout);
}

window.requestAnimationFrame(copyCutout);
