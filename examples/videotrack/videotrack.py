#!/usr/bin/env python
"""
Template for making scripts to run from the command line

Copyright (C) CSIRO 2019
"""
import pylab
import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import os
import sys
import logging
import cv2

__author__ = "Keith Bannister <keith.bannister@csiro.au>"

def run():
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    face_cascade = cv2.CascadeClassifier('haarcascade_frontalface_default.xml')
    nframes = 0
    total_ticks = 0

    while(True):
        # Capture frame-by-frame
        ret, frame = cap.read()

        h, w, chan = frame.shape

        # Our operations on the frame come here
        scale = 2
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        #frame = cv2.resize(frame, (w//scale, h//scale))
        gray = frame

        e1 = cv2.getTickCount()
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        e2 = cv2.getTickCount()
        total_ticks += (e2 - e1)
        nframes += 1

        if nframes % 100 == 0:
            nsec = float(total_ticks)/cv2.getTickFrequency()
            print("Face cascade takes for %d frames is %f frame/sec"%( nframes, float(nframes)/float(nsec)))
        
        # Draw rectangle around the faces
        for (x, y, w, h) in faces:
            cv2.rectangle(gray, (x, y), (x+w, y+h), (255, 0, 0), 2)
            # Display the output
        
        # Display the resulting frame
        cv2.imshow('frame',gray)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # When everything done, release the capture
    cap.release()
    cv2.destroyAllWindows()

def _main():
    from argparse import ArgumentParser, ArgumentDefaultsHelpFormatter
    parser = ArgumentParser(description='Script description', formatter_class=ArgumentDefaultsHelpFormatter)
    parser.add_argument('-v', '--verbose', dest='verbose', action='store_true', help='Be verbose')
    parser.set_defaults(verbose=False)
    values = parser.parse_args()
    if values.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    run()
    

if __name__ == '__main__':
    _main()
