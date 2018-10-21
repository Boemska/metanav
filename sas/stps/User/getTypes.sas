filename response temp;
proc metadata in=
 '<GetTypes><Types/><NS>SAS</NS>
   <!-- specify the OMI_SUCCINCT flag -->
   <Flags>2048</Flags>
   <Options>
     <!-- include <REPOSID> XML element and a repository identifier -->
     <Reposid>$METAREPOSITORY</Reposid>
   </Options>
  </GetTypes>'
  out=response;
run;
filename sxlemap temp;
data _null_;
  file sxlemap;
  put '<SXLEMAP version="1.2" name="SASTypes"><TABLE name="SASTypes">';
  put '<TABLE-PATH syntax="XPath">//GetTypes/Types/Type</TABLE-PATH>';
  put '<COLUMN name="ID">';
  put '<PATH syntax="XPath">//GetTypes/Types/Type/@Id</PATH></COLUMN>';
  put '<COLUMN name="Desc">';
  put '<PATH syntax="XPath">//GetTypes/Types/Type/@Desc</PATH></COLUMN>';
  put '<COLUMN name="HasSubtypes">';
  put '<PATH syntax="XPath">//GetTypes/Types/Type/@HasSubtypes</PATH></COLUMN>';
  put '</TABLE></SXLEMAP>';
run;
libname _XML_ xml xmlfileref=response xmlmap=sxlemap;
proc sort data=_XML_.sastypes out=sastypes;
  by id;
run;
%bafheader()
%bafOutDataset(SASTypes, work, SASTypes)
%bafFooter
filename sxlemap clear;
filename response clear;
libname _XML_ clear;