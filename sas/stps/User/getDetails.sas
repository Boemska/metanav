
%bafGetDatasets; /* get all input tables */

data _null_;
  set senduri;
  call symputx('uri',uri);
run;

data associations;
  keep assoc assocuri name;
  length assoc assocuri name $256;
  rc1=1;n1=1;
  do while(rc1>0);
    /* Walk through all possible associations of this object. */
    rc1=metadata_getnasl("&uri",n1,assoc);
    rc2=1;n2=1;
    do while(rc2>0);
      /* Walk through all the associations on this machine object. */
      rc2=metadata_getnasn("&uri",trim(assoc),n2,assocuri);
      if (rc2>0) then do;
        rc3=metadata_getattr(assocuri,"Name",name);
        output;
      end;
      call missing(name,assocuri);
      put arc= rc2=;
      n2+1;
    end;
    n1+1;
  end;
run;
proc sort data=associations;
  by assoc name;
run;

proc sql;
create table groupassoc as
  select assoc, count(*) as cnt
  from associations
  group by 1;

data attrprop;
  keep type name value;
  length type $4 name $256 value $32767;
  rc1=1;n1=1;type='Prop';
  do while(rc1>0);
    rc1=metadata_getnprp("&uri",n1,name,value);
    if rc1>0 then output;
    n1+1;
  end;
  rc1=1;n1=1;type='Attr';
  do while(rc1>0);
    rc1=metadata_getnatr("&uri",n1,name,value);
    if rc1>0 then output;
    n1+1;
  end;
run;
proc sort data=attrprop;
  by type name;
run;

%bafheader()
%bafOutDataset(Associations, work, Associations)
%bafOutDataset(attrprop, work, attrprop)
%bafOutDataset(groupassoc, work, groupassoc)
%bafFooter()