#!/bin/bash

buf_flags="-fflags nobuffer -avioflags direct -buffer_size 100k -reorder_queue_size 10 -max_delay 100 -bufsize 100k -rtbufsize 100k"

ffplay     -protocol_whitelist file,rtp,udp $buf_flags  -i video.sdp
