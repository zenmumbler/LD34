#!/bin/sh
if [ -d "data" ]
then
	echo Remove old data
	rm -r data
fi
echo Copy data
cp -r ../data data
if [ -f "sbe-itch-io.zip" ]
then
	echo Remove old zip
	rm sbe-itch-io.zip
fi
echo Make zip
zip -rq9 sbe-itch-io.zip index.html data  -x "*/.DS_Store" -x "data/sources/*"
echo Remove copy of data
rm -rf ./data
