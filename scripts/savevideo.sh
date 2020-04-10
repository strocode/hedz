#!/bin/bash

ffmpeg  -f avfoundation -framerate 25 -video_size 640x480 -i default -preset ultrafast -vcodec libx264 -tune zerolatency -b 900k  test.mpg
