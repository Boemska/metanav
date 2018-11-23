%bafGetDatasets()

%let type=SASLibrary;/*default value */
data _null_;
  set sendtype;
  call symputx('type',type);
run;
filename response temp;
proc metadata in=
 "<GetMetadataObjects>
   <Reposid>$METAREPOSITORY</Reposid>
   <Type>&type</Type>
   <Objects/>
   <NS>SAS</NS>
   <Flags>0</Flags>
   <Options/>
  </GetMetadataObjects>"
  out=response;
run;

/* write the response to the log for debugging
data _null_;
  infile response lrecl=1048576;
  input;
  put _infile_;
run;
*/

/* create an XML map to read the response */
filename sxlemap temp;
data _null_;
  file sxlemap;
  put '<SXLEMAP version="1.2" name="SASObjects"><TABLE name="SASObjects">';
  put "<TABLE-PATH syntax='XPath'>/GetMetadataObjects/Objects/&type</TABLE-PATH>";
  put '<COLUMN name="id">';
  put "<PATH syntax='XPath'>/GetMetadataObjects/Objects/&type/@Id</PATH>";
  put "<TYPE>character</TYPE><DATATYPE>string</DATATYPE><LENGTH>200</LENGTH>";
  put '</COLUMN><COLUMN name="name">';
  put "<PATH syntax='XPath'>/GetMetadataObjects/Objects/&type/@Name</PATH>";
  put "<TYPE>character</TYPE><DATATYPE>string</DATATYPE><LENGTH>200</LENGTH>";
  put '</COLUMN></TABLE></SXLEMAP>';
run;
libname _XML_ xml xmlfileref=response xmlmap=sxlemap;

proc sort data= _XML_.SASObjects out=SASObjects;
  by name;
run;

%bafheader()
%bafOutDataset(SASObjects, work, SASObjects)
%bafFooter()