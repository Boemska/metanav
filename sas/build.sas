/**
  @file
  @brief Creates the SPK for meta navigator
  @details Takes source code and creates the STPs for metanavigator.
    These are then exported (as SPK) and reimported for testing.

  Dependencies:
   - macrocore library
   - X CMD enabled
   - WM permissions on meta folder target

  @param loc_swa location of connection profile for export tool
  @param loc_deploy location in metadata to which to deploy the generated SPK.
    This is used to verify that the SPK was correctly generated.

  @version 9.4
  @author Allan Bowe
  @copyright GNU GENERAL PUBLIC LICENSE v3

**/


/* params */
%let loc_repo=/pub/apps/metanav; /* source code */
%let loc_h54=/pub/apps/metanav/sas/h54snew.sas; /* h54s adapter loc */
%let loc_build=/pub/builds/metanav; /* physical location for build artefacts */
%let loc_core=/pub/programs/macrocore; /* location of macrocore library */
%let loc_swa=~/.SASAppData/MetadataServerProfiles/apps.swa;
%let loc_deploy=/Tests/MetaNavigator;

/*
  macro from core library
  https://github.com/Boemska/macrocore/blob/master/meta/mm_updatestpsourcecode.sas
*/
options insert=(sasautos=("&loc_core/base"));
options insert=(sasautos=("&loc_core/meta"));

%let uid=%mf_uid();
%let build_dir=&loc_build/&uid;
%let deploy_dir=&loc_deploy/&uid;

%mf_mkdir(&build_dir)

proc printto log="&build_dir/sasbuild.log";
run;


/**
 * Prepare batch tools
 */
data _null_;
   h="%sysget(SASROOT)";
   h2=substr(h,1,index(h,"SASFoundation")-2);
   call symputx("platform_object_path"
    ,cats(h2,"/SASPlatformObjectFramework/&sysver"));
run;
%put Batch tool located at: &platform_object_path;

%let connx_string= -profile &loc_swa;


/**
 * Create build folders
 */
/* first, make folder */
data _null_;
  infile " cd ""&platform_object_path/tools"" %trim(
    ); ./sas-make-folder &connx_string  %trim(
    ) ""&deploy_dir"" -makeFullPath 2>&1"
    pipe lrecl=10000;
  input;list;
data _null_;
  infile " cd ""&platform_object_path/tools"" %trim(
    ); ./sas-make-folder &connx_string  %trim(
    ) ""&deploy_dir/MetaNavigator"" -makeFullPath 2>&1"
    pipe lrecl=10000;
  input;list;
data _null_;
  infile " cd ""&platform_object_path/tools"" %trim(
    ); ./sas-make-folder &connx_string  %trim(
    ) ""&deploy_dir/MetaNavigator/User"" -makeFullPath 2>&1"
    pipe lrecl=10000;
  input;list;


%let loc_meta=&deploy_dir/MetaNavigator;

options noquotelenmax;

%macro add_file(src=,stp=,h54=,tree=,stpdesc=);

  /* first - add adapter */
  %let sfile=%sysfunc(pathname(work))/temp.txt;
  data _null_;
    file "&sfile" lrecl=3000;
    if _n_=1 then put '/** Begin Adapter code **/';
    infile "&h54" end=eof;
    input;  put _infile_;
    if eof then do;
      put '/***  End Adapter Code ***/';
    end;
  run;

  /* now - add source code */
  data _null_;
    file "&sfile" lrecl=3000 mod;
    if _n_=1 then do;
      put '/** Begin source file Code **/';
    end;
    infile "&src" end=eof;
    input;  put _infile_;
    if eof then do;
      put '/***  End source file Code ***/';
    end;
  run;

  %mm_createstp(stpname=&stp
    ,filename=temp.txt
    ,directory=%sysfunc(pathname(work))
    ,tree=&tree
    ,Server=SASApp
    ,stptype=2
    ,mdebug=1
    ,stpdesc=&stpdesc)

%mend;

%let uid=MN%mf_uid();
%let uid_desc=Boemska App Identifier- &uid;

%let repo_root=&loc_repo/sas/stps/User;

%add_file(src=&repo_root/getDetails.sas
  ,stp=getDetails
  ,tree=&loc_meta/User
  ,h54=&loc_h54
  ,stpdesc=Service to drill into specific objects.  &uid_desc
)

%add_file(src=&repo_root/getObjects.sas
  ,stp=getObjects
  ,tree=&loc_meta/User
  ,h54=&loc_h54
  ,stpdesc=Service to retrieve all objects for a specific metadata type.  &uid_desc
)

%add_file(src=&repo_root/getTypes.sas
  ,stp=getTypes
  ,tree=&loc_meta/User
  ,h54=&loc_h54
  ,stpdesc=Service to retrieve all metadata types.  &uid_desc
)




/**
 * Now export the SPK
 */

options notes source2 mprint;

data _null_;
  infile "cd ""&platform_object_path"" %trim(
    ) ; ./ExportPackage &connx_string -disableX11 %trim(
    )-package ""&build_dir/import.spk"" %trim(
    )-objects ""&loc_meta(Folder)"" %trim(
    )-objects ""&loc_meta/User(Folder)"" %trim(
    )-objects ""&loc_meta/User/getDetails(StoredProcess)"" %trim(
    )-objects ""&loc_meta/User/getObjects(StoredProcess)"" %trim(
    )-objects ""&loc_meta/User/getTypes(StoredProcess)"" %trim(
    )-log ""&build_dir/spkexport.log"" 2>&1"
    pipe lrecl=10000;
  input;
  list;
run;

/**
 * We now have a generated SPK, lets deploy it to make sure it works ok
 */
/* first, make deploy folder */
data _null_;
  infile " cd ""&platform_object_path/tools"" %trim(
    ); ./sas-make-folder &connx_string  %trim(
    ) ""&deploy_dir/deploy"" -makeFullPath 2>&1"
    pipe lrecl=10000;
  input;
  list;
run;

/* now, import to that folder */
data _null_;
  infile "cd ""&platform_object_path"" %trim(
    ); ./ImportPackage &connx_string -disableX11 %trim(
    )-package ""&build_dir/import.spk"" %trim(
    )-target ""&deploy_dir/deploy(Folder)"" %trim(
    )-log ""&build_dir/spkimport.log"" 2>&1"
    pipe lrecl=10000;
  input; list;
run;

/* create the config file for web frontend */

data _null_;
  file "&build_dir/h54sConfig_boemska.json";
  string='{"metadataRoot":"'!!"&deploy_dir/deploy"!!'/MetaNavigator",'
    !!'"metadataRootLocator":"'!!"&uid"!!'"}';
  put string;
run;

data _null_;
  file "&build_dir/h54sConfig.json";
  put '{'/
      '  "metadataRoot":"/YOUR/METADATA/LOCATION/",' /
      '  "appId":"' "&uid" '"'/
      '}';
run;


/* show log */
proc printto log=log;
run;

data _null_;
  infile "&build_dir/sasbuild.log";
  input;
  putlog _infile_;
run;

data _null_;
  infile "&build_dir/spkexport.log";
  input;
  putlog _infile_;
run;

data _null_;
  infile "cd &build_dir; zip -r spk.zip . "
    pipe lrecl=10000;
  input; list;
run;

/* now serve zip file to client */
data _null_;
  rc = stpsrv_header('Content-type','application/zip');
  rc = stpsrv_header('Content-disposition',"attachment; filename=spk.zip");
run;

%mp_binarycopy(inloc="&build_dir/spk.zip"
  ,outref=_webout);

/*
filename response temp;
options noquotelenmax;
proc metadata in= "<GetMetadata>
 <Reposid>$METAREPOSITORY</Reposid>
 <Metadata><ClassifierMap id=""@Id='&stpid'""</Metadata>
 <NS>SAS</NS>
 <Flags>2</Flags>
 <Options>
 <XMLSelect search=""@Id='&stpid'""/>
 </Options>
 </GetMetadata>"
  out=response;
run; */