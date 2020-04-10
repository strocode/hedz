#!/bin/bash

# capture information here: https://trac.ffmpeg.org/wiki/Capture/Webcam
#@ SAP information here: https://www.ffmpeg.org/ffmpeg-protocols.html#sap
#ffmpeg -f avfoundation -framerate 15 -video_size 640x480 -pixel_format yuyv422 -i default -filter:v "format=yuv420p"  -preset ultrafast -vcodec libx264 -tune zerolatency -b:v 800k -reorder_queue_size 0 -f sap sap://224.0.0.10?same_port=1

buf_flags="-fflags nobuffer -avioflags direct -buffer_size 100k -rtmp_buffer 100 -reorder_queue_size 10 -max_delay 100 -bufsize 100k -rtbufsize 100k"

ffmpeg -f avfoundation -framerate 15 -video_size 640x480 -pixel_format yuyv422 -i default -filter:v "format=yuv420p"  -preset ultrafast -vcodec libx264 -tune zerolatency -b:v 800k -reorder_queue_size 0 -sdp_file video.sdp -max_delay 100 $buf_flags -f rtp rtp://224.0.0.10:9000

# See this to set delays:
# https://stackoverflow.com/questions/43075042/streaming-rtp-packets-using-sdp-to-ffmpeg

# With srtp:
#https://stackoverflow.com/questions/21433027/using-ffmpeg-for-stream-encryption-by-srtp-in-windows
# Send:
# 
#ffmpeg -re -i input.avi -f rtp_mpegts -acodec mp3 -srtp_out_suite AES_CM_128_HMAC_SHA1_80 -srtp_out_params zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz srtp://127.0.0.1:20000
#
# receive
# ffplay -srtp_in_suite AES_CM_128_HMAC_SHA1_80 -srtp_in_params zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz srtp://127.0.0.1:20000

# Use FFMPEG to open SDP file
# https://stackoverflow.com/questions/45907538/joining-a-video-stream-in-ffmpeg-by-passing-an-sdp-file-as-inline-data
#ffmpeg -protocol_whitelist file -i file.sdp

# play with ffplay video.sdp
#ffplay     -protocol_whitelist file,rtp,udp     -i video.sdp
