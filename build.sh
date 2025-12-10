#!/bin/bash

PATH="./node_modules/.bin:"${PATH}
rm -rfv dist/public \
  && rm -rfv dist/views \
  && tsc

