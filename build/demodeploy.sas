/**
  @file
  @brief Imports the User Navigator Demo SPK and deploys to home directory
  @details 
    Deploying the User Navigator in this way is NOT suitable for production 
    use due to the heavy impact on the web server (serving html from SAS).  
    The app is more scalable, and far faster, and will cost less to run,
    if deployed properly!!
    
    For proper release notes, see: 
    
    https://github.com/Boemska/metanav/blob/master/README.md

    That said, it's super easy to deploy this way ;-)

  Dependencies:
   - internet access to macrocore library
   - X CMD enabled
   - WM permissions on meta folder target

  @version 9.4
  @author Allan Bowe
  @copyright GNU GENERAL PUBLIC LICENSE v3

**/

/* get utility macros */
filename mc url "https://raw.githubusercontent.com/Boemska/macrocore/master/macrocore.sas";
%inc mc;

/* reference the demo SPK */
filename spk url 
  "https://github.com/allanbowe/random/blob/master/import.spk?raw=true";

/* pull the SPK into work */
%let work=%sysfunc(pathname(work));
%mp_binarycopy(inref=spk, outloc="&work/mn.spk")


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

