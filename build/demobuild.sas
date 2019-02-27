/**
  @file
  @brief Creates the Demo SPK for meta navigator
  @details The demo SPK compiles the frontend into a stored process.
    This is NOT suitable for production use due to the heavy impact on the web 
    server.  The app is more scalable, and far faster, and will cost less to run
    if deployed properly!!

    That said, it's super easy to deploy this way ;-)

  Dependencies:
   - internet access to macrocore library
   - X CMD enabled
   - WM permissions on meta folder target

  @param METAROOT= passed from command line, location where metadata is built

  @version 9.4
  @author Allan Bowe
  @copyright GNU GENERAL PUBLIC LICENSE v3

**/


/* params */
%let loc_swa=~/.SASAppData/MetadataServerProfiles/apps.swa;

/* macrocore library */
filename mc url 
  "https://raw.githubusercontent.com/Boemska/macrocore/master/macrocore.sas";
%inc mc;

%let build_dir=%sysfunc(pathname(work))/dl;
%mf_mkdir(&build_dir)
proc printto log="&build_dir/build.log";
run;
options mprint noquotelenmax ps=max;
%mf_verifymacvars(metaroot)

/* unzip file(s) */
%let work=%sysfunc(pathname(work));
data _null_;
  infile "unzip %sysfunc(pathname(&_WEBIN_FILEREF2)) -d &work" pipe;
  input;
  putlog _infile_;
run;


%let deploy_dir=&metaroot;

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
    ) ""&metaroot"" -makeFullPath 2>&1"
    pipe lrecl=10000;
  input;list;
data _null_;
  infile " cd ""&platform_object_path/tools"" %trim(
    ); ./sas-make-folder &connx_string  %trim(
    ) ""&deploy_dir"" -makeFullPath 2>&1"
    pipe lrecl=10000;
  input;list;
data _null_;
  infile " cd ""&platform_object_path/tools"" %trim(
    ); ./sas-make-folder &connx_string  %trim(
    ) ""&deploy_dir/User"" -makeFullPath 2>&1"
    pipe lrecl=10000;
  input;list;
run;

%let loc_meta=&deploy_dir;

options noquotelenmax;

%macro add_file(src=,stp=,h54=,tree=,stpdesc=);

  /* first - add adapter */
  data _null_;
    file "&work/temp.txt" lrecl=32000 ;
    if _n_=1 then put '/** Begin Adapter code **/';
    infile "&h54" end=eof;
    input;  put _infile_;
    if eof then do;
      put '/***  End Adapter Code ***/';
    end;
  run;

  /* now - add source code */
  data _null_;
    file "&work/temp.txt" lrecl=32000 mod;
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

  /* update source code (so will load twice on first instance, but no harm) */
  %mm_updatestpsourcecode(stp=&tree/&stp
    ,stpcode="&work/temp.txt")

%mend;

%let uid=MN%mf_uid();
%let uid_desc=Boemska App Identifier- &uid;

%let repo_root=&work/sas/stps/User;
%let loc_h54=&work/sas/h54snew.sas ;

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

/*
 * FRONTEND
 */

/* the aim is to create a sas program that can generate the front web page */

%let outsasfile=%sysfunc(pathname(work))/frontend.sas;

data _null_;
  file "&outsasfile" lrecl=32000;
  put 'filename ft15f001 temp lrecl=32000;';
  put 'parmcards4;';

data _null_;
  infile "&work/dist/index.html" lrecl=32000; /* index.html */
  file "&outsasfile" mod lrecl=32000;
  input;
  length string url $32000;
  url="/SASStoredProcess/do?_program=&deploy_dir/frontend_renderer"
    !!cats('&uid=',round(ranuni(0)*10000,5));
  string=tranwrd(_infile_,'"main.js"',cats('"',url,'&metacontent=main&type=js&clienthost="+window.location.origin'));
  string=tranwrd(string,'"inline.js"',cats('"',url,'&metacontent=inline&type=js"'));
  string=tranwrd(string,'"scripts.js"',cats('"',url,'&metacontent=scripts&type=js"'));
  string=tranwrd(string,'"styles.css"',cats('"',url,'&metacontent=styles&type=css"'));
  string=tranwrd(string,'"vendor.js"',cats('"',url,'&metacontent=vendor&type=js"'));
  put string;

data _null_;
  file "&outsasfile" mod;
  put ';;;;';
  put 'data _null_;infile ft15f001 lrecl=32000;file _webout lrecl=32000;input;';
  put 'length str $32767;';
  put 'if _n_=1 then do;pgm="&_program";putlog pgm=;';
  put 'pgm=substr(pgm,1,index(pgm,"/MetaNavigatorDemo/frontend")+17);';
  put 'putlog pgm=;end; retain pgm;';
  put "str=trim(tranwrd(_infile_,'&deploy_dir',cats(pgm)));";
  put 'put str;run;';
run;


%mm_createstp(stpname=frontend
  ,filename=frontend.sas
  ,directory=%sysfunc(pathname(work))
  ,tree=&deploy_dir
  ,Server=SASApp
  ,stptype=2
  ,mdebug=1
  ,minify=NO)

/* update source code (so will load twice on first instance, but no harm) */
%mm_updatestpsourcecode(stp=&deploy_dir/frontend
  ,stpcode="&outsasfile")



/* load each JS to a metadata object (they may have lines longer than 32k so
  will not fit in a parmcards list) */

%mm_createdocument(tree=&deploy_dir,name=main)
%mm_updatedocument(path=&deploy_dir,name=main,text="&work/dist/main.js")

%mm_createdocument(tree=&deploy_dir,name=inline)
%mm_updatedocument(path=&deploy_dir,name=inline,text="&work/dist/inline.js")

%mm_createdocument(tree=&deploy_dir,name=scripts)
%mm_updatedocument(path=&deploy_dir,name=scripts,text="&work/dist/scripts.js")

%mm_createdocument(tree=&deploy_dir,name=styles)
%mm_updatedocument(path=&deploy_dir,name=styles,text="&work/dist/styles.css")

%mm_createdocument(tree=&deploy_dir,name=vendor)
%mm_updatedocument(path=&deploy_dir,name=vendor,text="&work/dist/vendor.js")

/* create stp that can return the JS/ CSS content via &metacontent param */
%let outsasfile2=%sysfunc(pathname(work))/frontend_renderer.sas;

data _null_;
  file "&outsasfile2";
  infile datalines ;
  input;
  put _infile_;
datalines4;
/*  FRONTEND RENDERER */
data _null_;
  format type uri tsuri value $200.;
  call missing (of _all_);
  pgm="&_program";
  pgm=substr(pgm,1,index(pgm,"/frontend")-1);
  retain pgm;
  path=trim(pgm)!!"/&metacontent(Note)";
  rc=metadata_pathobj("",trim(pgm)!!"/&metacontent(Note)","Note",type,uri);
  rc=metadata_getnasn(uri,"Notes",1,tsuri);
  rc=metadata_getattr(tsuri,"Id",value);
  call symputx("tsid",value);
  call symputx('_root',pgm);
run;
filename tmp temp lrecl=10000000;
proc metadata
 in="<GetMetadata><Reposid>$METAREPOSITORY</Reposid>
    <Metadata><TextStore Id='&tsid'/></Metadata>
    <Ns>SAS</Ns><Flags>1</Flags><Options/></GetMetadata>"
 out=tmp ;
run;
data _null_;
  infile tmp lrecl=1000;
  input;
  start=index(_infile_,'StoredText="');
  call symputx("start",start+11);
  if "&type"="js" then rc=stpsrv_header("Content-type","application/javascript");
  else if "&type"="css" then rc=stpsrv_header("Content-type","text/css");
  /* for main.js we need to switch out the metadata root - this will take
    another pass through the data */
  if "&metacontent"='main' then call symputx('outref','tmp2');
  else call symputx('outref','_webout');
  stop;
filename tmp2 temp lrecl=100000;
data _null_;
 length filein 8 fileid 8;
 filein = fopen("tmp","I",1,"B");
 fileid = fopen("&outref","O",1,"B");
 rec = "20"x;
 entity='entity';
 do while(fread(filein)=0);
   x+1;
   if x>&start then do;
    rc = fget(filein,rec,1);
    if rec='"' then leave;
    else if rec="&" then do;
      entity=rec;
      do until (rec=";");
        if fread(filein) ne 0 then goto getout;
        rc = fget(filein,rec,1);
        entity=cats(entity,rec);
      end;
      select (entity);
        when ('&amp;' ) rec='&'  ;
        when ('&lt;'  ) rec='<'  ;
        when ('&gt;'  ) rec='>'  ;
        when ('&apos;') rec="'"  ;
        when ('&quot;') rec='"'  ;
        when ('&#x0a;') rec='0A'x;
        when ('&#x0d;') rec='0D'x;
        when ('&#36;' ) rec='$'  ;
        otherwise putlog "WARNING: missing value for " entity=;
      end;
      rc =fput(fileid, substr(rec,1,1));
      rc =fwrite(fileid);
    end;
    else do;
      rc =fput(fileid,rec);
      rc =fwrite(fileid);
    end;
   end;
 end;
 getout:
 rc=fclose(filein);
 rc=fclose(fileid);
run;
%put &=outref;

proc lua restart;
submit;
  if sas.symget('outref')=='_webout' then return end
  -- read entire file into one lua variable, 10000 bytes at a time
  str=string.rep(' ',10000)
  --fref=sas.filename('fref',sas.symget('tmp2'))
  fid=sas.fopen('tmp2','I',10000,'F')
  t={}
  while (sas.fread(fid)==0) do 
    rc=sas.fget(fid,str,10000)
    t[#t+1]=str:sub(1,10000) -- use substring to prevent passing of values by reference
  end
  rc=sas.fclose(fid)
  bigstr=table.concat(t)

  -- perform string manipulation
  bigstr=bigstr:gsub('/Apps/Meta Navigator',sas.symget('_root'))
  bigstr=bigstr:gsub('https://apps.boemskats.com',sas.symget('clienthost'))

  -- write file back out to disk
  fid=sas.fopen('_webout','O',10000,'B')
  print(fid)
  local i=1;
  while (i<bigstr:len()) do
    str=bigstr:sub(i,i+10000)
    rc=sas.fput(fid,str)
    rc=sas.fwrite(fid)
    i=i+10001
  end;
  rc=sas.fclose(fid)
endsubmit;
run;
/* FRONTEND RENDERER END */
;;;;
run;

%mm_createstp(stpname=frontend_renderer
  ,filename=frontend_renderer.sas
  ,directory=%sysfunc(pathname(work))
  ,tree=&deploy_dir
  ,Server=SASApp
  ,stptype=2
  ,mdebug=1
  ,minify=NO)

/* update source code (so will load twice on first instance, but no harm) */
%mm_updatestpsourcecode(stp=&deploy_dir/frontend_renderer
  ,stpcode="&outsasfile2")




/**
 * Now export the SPK
 */

options notes source2 mprint;

data _null_;
  infile "cd ""&platform_object_path"" %trim(
    ) ; ./ExportPackage &connx_string -disableX11 %trim(
    )-package ""&build_dir/import.spk"" %trim(
    )-objects ""&deploy_dir(Folder)"" %trim(
    )-objects ""&deploy_dir/User(Folder)"" %trim(
    )-objects ""&deploy_dir/User/getDetails(StoredProcess)"" %trim(
    )-objects ""&deploy_dir/User/getObjects(StoredProcess)"" %trim(
    )-objects ""&deploy_dir/User/getTypes(StoredProcess)"" %trim(
    )-objects ""&deploy_dir/frontend(StoredProcess)"" %trim(
    )-objects ""&deploy_dir/frontend_renderer(StoredProcess)"" %trim(
    )-objects ""&deploy_dir/main(Note)"" %trim(
    )-objects ""&deploy_dir/inline(Note)"" %trim(
    )-objects ""&deploy_dir/scripts(Note)"" %trim(
    )-objects ""&deploy_dir/styles(Note)"" %trim(
    )-objects ""&deploy_dir/vendor(Note)"" %trim(
    )-log ""&build_dir/spkexport.log"" 2>&1"
    pipe lrecl=10000;
  input;
  list;
run;

proc printto log=log;run;
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
  ,outref=_webout)

%mp_binarycopy(inloc="&build_dir/import.spk"
  ,outloc="/tmp/metanavdemo.spk")