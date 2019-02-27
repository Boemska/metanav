#!/usr/bin/env bash
####################################################################
# PROJECT: Meta-Navigator                                          #
####################################################################

# Before running, be sure to modify /src/app/boemska/h54s.config.ts
# remote config should be set as follows:
#export const AdapterSettings = {
#  metadataRoot: "/Apps/Meta Navigator/",
#  hostUrl: "https://apps.boemskats.com",
#  isRemoteConfig: false
#};

set -o nounset                              # Treat unset variables as an error
BUILDLOC="/tmp/undemobuild"
BUILDSTP="/Shared%20Folders/admin/injectSAS"
BUILDSERVER="https://apps.boemskats.com"
METAROOT="/Tests/MetaNavigatorDemo";
SCPTARGET="apps.boemskats.com:/pub/ht/demo/undemo"

# get root of repo
cd ..
CWD=$(pwd)

# Prepare SAS locs
STPSVR="$BUILDSERVER/SASStoredProcess/do"
STPURI="&STPSVR?_program=$BUILDSTP&METAROOT=$METAROOT"

# get SAS creds for running the build STP
read -s -p "enter creds? " -i "N" -e answer
echo "you answered: $answer"
if [ "$answer" != "N" ]
then
    echo -n What is your SAS username? :
    read USER
    echo -n What is your SAS password? :
    stty -echo
    read PASS
    stty echo
    echo "username=$USER&password=$PASS">~/.ssh/sascred
    echo "_username=$USER&_password=$PASS">~/.ssh/sascredurl
fi
CREDS=$(cat ~/.ssh/sascredurl)

#  Build Frontend
read -s -p "Build Frontend? (type any character for yes) " -i "N" -e answer
echo "Build Frontend? You answered: $answer"
if [ "$answer" != "N" ]
then
    npm install
    ng build --prod --aot --base-href ./
    cd dist
    mv main.*.js    main.js
    mv inline.*.js inline.js
    mv scripts.*.js scripts.js
    mv styles.*.css styles.css
    mv vendor.*.js vendor.js
    # rename files and update index.html
    perl -i -pe 's/main\..+?\.js/main.js/g;' index.html
    perl -i -pe 's/inline\..+?\.js/inline.js/g;' index.html
    perl -i -pe 's/scripts\..+?\.js/scripts.js/g;' index.html
    perl -i -pe 's/styles\..+?\.css/styles.css/g;' index.html
    perl -i -pe 's/vendor\..+?\.js/vendor.js/g;' index.html
    cd ..
fi

# make build folder
if [ -d "$BUILDLOC" ]; then
  rm -rf $BUILDLOC
  echo [$BUILDLOC rebuilt]
fi
mkdir $BUILDLOC

# Create zip file for relevant files
zip -r $BUILDLOC/archive build dist sas 

cd $BUILDLOC

# run a dummy service (sometimes it only works on second try)
# -v OR --trace-ascii -
echo "data;set sashelp.class;run;">test.sas
curl -v -L -k  -b cookiefile -c cookiefile \
    -H "Content-Type: multipart/form-data" \
    -F "data=@test.sas" \
      "$STPSVR?_program=$BUILDSTP&$CREDS&METAROOT=$METAROOT&_debug=log"

curl -L -k  -b cookiefile -c cookiefile \
    -H "Content-Type: multipart/form-data" \
    -F "data=@$CWD/build/demobuild.sas" \
    -F "zipfile=@$BUILDLOC/archive.zip" \
      "$STPSVR?_program=$BUILDSTP&$CREDS&METAROOT=$METAROOT" \
    --output "$BUILDLOC/sas.zip"
unzip sas.zip

exit

echo ---------------------------------------------------------------
echo  Perform SAS Build
echo ---------------------------------------------------------------
# Build & deploy SAS services, downloading SPK and config file
curl -v -L -k -b cookiefile -c cookiefile \
  -d "_program=$BUILDSTP&_username=$USERNAME&_password=$PASSWORD" \
  $BUILDSERVER --output SAS.zip
unzip SAS.zip -d ./contents

# Copy SPK and config file to client build
cp $SCRLOC/tmp/contents/import.spk $SCRLOC/tmp/$BUILD_FOLDER


echo ---------------------------------------------------------------
echo  Git Clone
echo ---------------------------------------------------------------
git clone $GIT_PROJECT $SCRLOC/tmp/$PROJECT_FOLDER
cd $SCRLOC/tmp/$PROJECT_FOLDER
git checkout $FEATURE_BRANCH

echo ---------------------------------------------------------------
echo "NPM Install && Versioning"
echo ---------------------------------------------------------------
npm install

echo ---------------------------------------------------------------
echo Build repo
echo ---------------------------------------------------------------
ng build --prod --aot --base-href ./


echo ---------------------------------------------------------------
echo Copy build files across to client build repo
echo ---------------------------------------------------------------
mkdir $SCRLOC/tmp/$BUILD_FOLDER/metanavigator
#git clone $GIT_BUILD $SCRLOC/tmp/$BUILD_FOLDER/
cd $SCRLOC/tmp/$BUILD_FOLDER/metanavigator
cp -a $SCRLOC/tmp/$PROJECT_FOLDER/dist/. $SCRLOC/tmp/$BUILD_FOLDER/metanavigator

echo ---------------------------------------------------------------
echo Deploy to Boemska test repo
echo ---------------------------------------------------------------

mkdir $SCRLOC/tmp/test
cp -a $SCRLOC/tmp/$PROJECT_FOLDER/dist/. $SCRLOC/tmp/test
cp $SCRLOC/tmp/contents/h54sConfig_boemska.json $SCRLOC/tmp/test/h54sConfig.json
rsync -avz --exclude .git/ --exclude .gitignore --del $SCRLOC/tmp/test/* \
    $USERNAME@$TESTSCPTARGET

echo ---------------------------------------------------------------
echo Create Zip folder
echo ---------------------------------------------------------------


cp $SCRLOC/tmp/contents/h54sConfig.json \
    $SCRLOC/tmp/$BUILD_FOLDER/metanavigator/h54sConfig.json
cd $SCRLOC/tmp
zip -r meta-navigator.zip $BUILD_FOLDER/*


echo ---------------------------------------------------------------
echo Finish
echo ---------------------------------------------------------------
