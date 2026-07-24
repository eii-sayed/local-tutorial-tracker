const STORAGE_KEY = "tutorial-tracker-v2";
const VIDEO_EXT = new Set(["mp4","webm","ogg","mov","m4v","mkv"]);
const RESOURCE_EXT = new Set(["pdf","ppt","pptx","html","htm","txt","doc","docx","xls","xlsx","csv","zip","rar","7z","ipynb","py","bin"]);
const $ = (s) => document.querySelector(s);
let course = null, selected = null, filter = "all", urls = [];
const collator = new Intl.Collator(undefined,{numeric:true,sensitivity:"base"});

function saved(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")}catch{return {}}}
function persist(id,patch,skipRender=false){const data=saved();data[id]={...(data[id]||{}),...patch};localStorage.setItem(STORAGE_KEY,JSON.stringify(data));if(selected?.id===id)Object.assign(selected,patch);const lesson=findLesson(id);if(lesson)Object.assign(lesson,patch);if(!skipRender){renderTree();renderSummary()}}
function extension(name){return (name.split(".").pop()||"").toLowerCase()}
function leadingNumber(name){const m=name.match(/^\s*(\d+)\s*[.\-_)]?/);return m?Number(m[1]):999999}
function cleanSection(name){return name.replace(/^\s*\d+\s*[-._)]\s*/,"").trim()||name}
function cleanLesson(name){return name.replace(/\.[^.]+$/,"").replace(/^\s*\d+\s*[.\-_)]\s*/,"").replace(/^\s*\d+\s+\d+\s+/,"").replace(/\s+/g," ").trim()}
function makeId(path,size,modified){return `${path}|${size}|${modified}`}
function fmt(sec=0){sec=Math.floor(Number(sec)||0);const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`}
function sizeText(n){if(n<1024*1024)return `${Math.ceil(n/1024)} KB`;return `${(n/1024/1024).toFixed(1)} MB`}
function revoke(){urls.forEach(URL.revokeObjectURL);urls=[]}

function buildCourse(fileList){revoke();const files=[...fileList];if(!files.length)return;const root=files[0].webkitRelativePath?.split("/")[0]||"Local Course";const states=saved();const sectionMap=new Map();
 for(const file of files){const path=file.webkitRelativePath||file.name;const parts=path.split("/");if(parts.length<2)continue;const sectionRaw=parts.length>2?parts[1]:"Course Files";if(!sectionMap.has(sectionRaw))sectionMap.set(sectionRaw,{raw:sectionRaw,number:leadingNumber(sectionRaw),title:cleanSection(sectionRaw),groups:new Map()});const section=sectionMap.get(sectionRaw);const ext=extension(file.name);if(!VIDEO_EXT.has(ext)&&!RESOURCE_EXT.has(ext))continue;const groupNo=leadingNumber(file.name);const key=groupNo===999999?`x-${file.name}`:String(groupNo);if(!section.groups.has(key))section.groups.set(key,{number:groupNo,files:[]});const url=URL.createObjectURL(file);urls.push(url);section.groups.get(key).files.push({file,url,path,ext,type:VIDEO_EXT.has(ext)?"video":"resource"})}
 const sections=[...sectionMap.values()].sort((a,b)=>a.number-b.number||collator.compare(a.raw,b.raw)).map(section=>{const lessons=[...section.groups.values()].sort((a,b)=>a.number-b.number).map(group=>{const video=group.files.find(x=>x.type==="video");const primary=video||group.files[0];const id=makeId(primary.path,primary.file.size,primary.file.lastModified);return{id,number:group.number,title:cleanLesson(video?.file.name||primary.file.name),video,resources:group.files.filter(x=>x!==video),progress:0,currentTime:0,duration:0,completed:false,notes:"",bookmarks:[],resourceStates:{},...(states[id]||{})}});return{...section,lessons}});
 course={title:root,sections};selected=null;$("#emptyState").hidden=true;$("#app").hidden=false;$("#toggleSidebarBtn").hidden=false;$("#globalSearchBtn").hidden=false;renderSummary();renderTree();const lastId=localStorage.getItem(`${STORAGE_KEY}-last`);const last=findLesson(lastId);$("#continueBtn").hidden=!last;if(last)selectLesson(last,false)}

function allLessons(){return course?course.sections.flatMap(s=>s.lessons):[]}
function findLesson(id){return allLessons().find(l=>l.id===id)}
function sectionFor(id){return course?.sections.find(s=>s.lessons.some(l=>l.id===id))}
function renderSummary(){if(!course)return;const lessons=allLessons(),videos=lessons.filter(l=>l.video),done=videos.filter(l=>l.completed).length,avg=videos.length?Math.round(videos.reduce((n,l)=>n+(l.completed?100:l.progress||0),0)/videos.length):0;const resources=lessons.flatMap(l=>l.resources.map(r=>({l,r})));const reviewed=resources.filter(({l,r})=>l.resourceStates?.[r.path]?.reviewed).length;$("#courseTitle").textContent=course.title;$("#courseMeta").textContent=`${course.sections.length} sections • ${videos.length} videos • ${done} completed`;$("#resourceMeta").textContent=`${reviewed} of ${resources.length} resources reviewed`;$("#overallText").textContent=`${avg}%`;$("#overallBar").style.width=`${avg}%`}
function matches(lesson,section,q){const status=lesson.completed?"completed":lesson.progress>0?"progress":"new";return(!q||`${lesson.title} ${section.title}`.toLowerCase().includes(q))&&(filter==="all"||filter===status)}
function renderTree(){if(!course)return;const tree=$("#courseTree"),q=$("#searchInput").value.trim().toLowerCase(),openSection=sectionFor(selected?.id);const scroll=tree.scrollTop;const openTitles=new Set([...tree.querySelectorAll(".tree-section.open strong")].map(x=>x.textContent));tree.innerHTML="";let count=0;
 course.sections.forEach(section=>{const lessons=section.lessons.filter(l=>matches(l,section,q));if(!lessons.length)return;count+=lessons.length;const node=$("#sectionTemplate").content.firstElementChild.cloneNode(true);const playable=section.lessons.filter(l=>l.video),done=playable.filter(l=>l.completed).length,pct=playable.length?Math.round(playable.reduce((n,l)=>n+(l.completed?100:l.progress||0),0)/playable.length):0;const titleText=`${section.number<999999?section.number+". ":""}${section.title}`;node.querySelector("strong").textContent=titleText;node.querySelector(".section-copy small").textContent=`${playable.length} videos • ${done} complete`;node.querySelector(".section-percent").textContent=`${pct}%`;if(section===openSection||q||openTitles.has(titleText))node.classList.add("open");node.querySelector(".section-toggle").onclick=()=>node.classList.toggle("open");const list=node.querySelector(".lesson-list");lessons.forEach(lesson=>{const b=document.createElement("button");b.className=`lesson ${lesson.completed?"done":""} ${selected?.id===lesson.id?"active":""}`;b.innerHTML=`<span class="lesson-status">${lesson.completed?"✓":lesson.video?"▶":"•"}</span><span class="lesson-copy"><strong>${escapeHtml(lesson.title)}</strong><small>${lesson.video?`${lesson.progress||0}% watched`:"Resources"}${lesson.resources.length?` • ${lesson.resources.length} files`:""}</small><span class="mini-progress"><i style="width:${lesson.completed?100:lesson.progress||0}%"></i></span></span>`;b.onclick=()=>selectLesson(lesson,true);list.appendChild(b)});tree.appendChild(node)});if(!count)tree.innerHTML='<div class="no-results">No matching lessons</div>';tree.scrollTop=scroll;}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}

function selectLesson(lesson,autoplay){resetPreview();$("#previewCard").hidden=true;selected=lesson;localStorage.setItem(`${STORAGE_KEY}-last`,lesson.id);const section=sectionFor(lesson.id),player=$("#videoPlayer");$("#lessonHeader").hidden=false;$("#watchInfo").hidden=!lesson.video;$("#resourcesCard").hidden=!lesson.resources.length;$("#notesCard").hidden=false;$("#bookmarksCard").hidden=!lesson.video;$("#sectionName").textContent=`Section ${section.number}: ${section.title}`;$("#lessonTitle").textContent=lesson.title;$("#notes").value=lesson.notes||"";updateCompleteButton();renderResources();renderBookmarks();if(lesson.video){
  const errorBox=$("#videoError"), errorText=$("#videoErrorText"), external=$("#externalVideo");
  errorBox.hidden=true; player.hidden=false; $("#playerEmpty").hidden=true;
  player.pause(); player.removeAttribute("src"); player.load();
  player.src=lesson.video.url; external.href=lesson.video.url; external.download=lesson.video.file.name;
  player.onerror=()=>{const code=player.error?.code||0;const messages={1:"Playback was stopped before loading finished.",2:"Chrome could not read the selected local file.",3:"Chrome could not decode this video. The MP4 may use HEVC/H.265, AV1, or another unsupported codec.",4:"This video format or codec is not supported by Chrome."};player.hidden=true;errorText.textContent=(messages[code]||"The selected video could not be played.")+" Try the Open or download video button. For browser playback, convert the file to MP4 using H.264 video and AAC audio.";errorBox.hidden=false};
  player.onloadedmetadata=()=>{errorBox.hidden=true;player.hidden=false;player.currentTime=Math.min(lesson.currentTime||0,Math.max(0,player.duration-1));player.playbackRate=parseFloat($("#playbackSpeed").value);updateWatch();if(autoplay)player.play().catch(()=>{})};
  player.load(); player.focus();
}else{player.pause();player.removeAttribute("src");player.load();player.hidden=true;$("#videoError").hidden=true;$("#playerEmpty").hidden=false;$("#playerEmpty").textContent="This lesson contains resources only";if(lesson.resources.length){const prev=lesson.resources.find(canPreview);if(prev){$("#playerEmpty").hidden=true;previewResource(prev);}else showUnsupported(lesson.resources[0]);}}renderTree();setTimeout(()=>{$(".lesson.active")?.scrollIntoView({behavior:"smooth",block:"center"})}, 100)}
function updateCompleteButton(){const b=$("#completeBtn");b.textContent=selected?.completed?"✓ Completed":"Mark complete";b.className=`button ${selected?.completed?"primary":"secondary"}`}
function updateWatch(){if(!selected)return;$("#watchTime").textContent=`${fmt(selected.currentTime)} watched`;$("#watchPercent").textContent=`${selected.progress||0}%`}
function resourceState(resource){return selected.resourceStates?.[resource.path]||{opened:false,reviewed:false}}
function updateResourceState(resource,patch){const states={...(selected.resourceStates||{})};states[resource.path]={...(states[resource.path]||{}),...patch};persist(selected.id,{resourceStates:states});renderResources()}
function canPreview(resource){return ["pdf","html","htm","txt","md","csv","json","py","js","css"].includes(resource.ext)}
function resetPreview(){const frame=$("#resourcePreview"),text=$("#textPreview"),message=$("#previewUnsupported"),loading=$("#previewLoading");frame.hidden=true;frame.removeAttribute("src");frame.removeAttribute("srcdoc");text.hidden=true;text.textContent="";message.hidden=true;message.innerHTML="";loading.hidden=true}
function readAsDataURL(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)})}
function readAsText(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsText(file)})}
async function previewResource(resource){updateResourceState(resource,{opened:true});resetPreview();const card=$("#previewCard"),frame=$("#resourcePreview"),text=$("#textPreview"),message=$("#previewUnsupported"),loading=$("#previewLoading");$("#previewTitle").textContent=resource.file.name;card.hidden=false;$("#resourceExternal").onclick=()=>openResource(resource);loading.hidden=false;card.scrollIntoView({behavior:"smooth",block:"start"});try{if(resource.ext==="pdf"){frame.src=resource.url;frame.hidden=false}else if(["html","htm"].includes(resource.ext)){const source=await readAsText(resource.file);frame.srcdoc=source;frame.hidden=false}else if(["txt","md","csv","json","py","js","css"].includes(resource.ext)){text.textContent=await readAsText(resource.file);text.hidden=false}else{showUnsupported(resource)}}catch(error){message.innerHTML=`<div><strong>Could not preview this resource</strong><br>${escapeHtml(error?.message||"The browser could not read the selected file.")}</div>`;message.hidden=false}finally{loading.hidden=true}}
function showUnsupported(resource){resetPreview();const message=$("#previewUnsupported");const office=["ppt","pptx","doc","docx","xls","xlsx"].includes(resource.ext);message.innerHTML=office?`<div><strong>${resource.ext.toUpperCase()} files cannot be rendered directly by a browser from a private local folder.</strong><br><br>The resource is selected here below the video. Use <b>Open externally</b> to launch the installed Microsoft Office application, or convert the file to PDF for an in-app preview.</div>`:`<div><strong>Preview is not available for .${escapeHtml(resource.ext)} files.</strong><br><br>Use <b>Open externally</b> to open or download this resource.</div>`;message.hidden=false;$("#previewCard").hidden=false;$("#previewTitle").textContent=resource.file.name;$("#resourceExternal").onclick=()=>openResource(resource);$("#previewCard").scrollIntoView({behavior:"smooth",block:"start"})}
function openResource(resource){updateResourceState(resource,{opened:true});const a=document.createElement("a");a.href=resource.url;a.target="_blank";a.rel="noopener";a.download=resource.file.name;document.body.appendChild(a);a.click();a.remove()}
function renderResources(){const box=$("#resources");box.innerHTML="";for(const r of selected.resources){const state=resourceState(r),row=document.createElement("div");row.className=`resource ${state.reviewed?"reviewed":""}`;const type=r.ext.toUpperCase();const stateText=state.reviewed?"Reviewed":state.opened?"Opened":"Not opened";row.innerHTML=`<span class="resource-icon">${escapeHtml(type)}</span><span class="resource-copy"><strong>${escapeHtml(r.file.name)}</strong><small>${sizeText(r.file.size)} • <span class="resource-state">${stateText}</span></small></span><span class="resource-actions"></span>`;const actions=row.querySelector(".resource-actions");const view=document.createElement("button");view.textContent=canPreview(r)?"View below video":"Select below video";view.onclick=()=>canPreview(r)?previewResource(r):showUnsupported(r);actions.appendChild(view);const open=document.createElement("button");open.textContent="Open externally";open.onclick=()=>openResource(r);actions.appendChild(open);const review=document.createElement("button");review.textContent=state.reviewed?"✓ Reviewed":"Mark reviewed";review.onclick=()=>updateResourceState(r,{reviewed:!state.reviewed,opened:true});actions.appendChild(review);box.appendChild(row)}}
function renderBookmarks(){const box=$("#bookmarksList");box.innerHTML="";if(!selected)return;const bmarks=selected.bookmarks||[];if(!bmarks.length){box.innerHTML='<p style="color:var(--muted);font-size:13px;margin:0">No bookmarks yet.</p>';return}bmarks.sort((a,b)=>a.time-b.time).forEach((b,i)=>{const d=document.createElement("div");d.className="bookmark-item";d.innerHTML=`<span class="bookmark-time">${fmt(b.time)}</span><p class="bookmark-text">${escapeHtml(b.text)}</p><button class="bookmark-delete" title="Delete">×</button>`;d.querySelector(".bookmark-time").onclick=()=>{const p=$("#videoPlayer");if(p)p.currentTime=b.time};d.querySelector(".bookmark-delete").onclick=()=>{bmarks.splice(i,1);persist(selected.id,{bookmarks:bmarks});renderBookmarks()};box.appendChild(d)})}
$("#addBookmarkForm").onsubmit=(e)=>{e.preventDefault();if(!selected||!selected.video)return;const input=$("#bookmarkNote"),text=input.value.trim();if(!text)return;const bmarks=selected.bookmarks||[],p=$("#videoPlayer");bmarks.push({time:p.currentTime||0,text});persist(selected.id,{bookmarks:bmarks});input.value="";renderBookmarks()};
$("#closePreview").onclick=()=>{resetPreview();$("#previewCard").hidden=true};
function savePlayer(){const p=$("#videoPlayer");if(!selected?.video||!p.duration)return;const progress=Math.min(100,Math.round(p.currentTime/p.duration*100));persist(selected.id,{currentTime:p.currentTime,duration:p.duration,progress,completed:progress>=95||selected.completed},true);const activeMini=document.querySelector(".lesson.active .mini-progress i");if(activeMini)activeMini.style.width=`${progress}%`;updateWatch();updateCompleteButton()}
function nextVideo(){const vids=allLessons().filter(l=>l.video),i=vids.findIndex(l=>l.id===selected.id);persist(selected.id,{completed:true,progress:100,currentTime:selected.duration||$("#videoPlayer").duration});if(vids[i+1])selectLesson(vids[i+1],true)}

[$("#folderInput"),$("#emptyFolderInput")].forEach(i=>i.addEventListener("change",e=>buildCourse(e.target.files)));
$("#searchInput").addEventListener("input",renderTree);
document.querySelectorAll(".filters button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;renderTree()});
$("#videoPlayer").addEventListener("pause",savePlayer);$("#videoPlayer").addEventListener("ended",nextVideo);let lastSave=0;$("#videoPlayer").addEventListener("timeupdate",()=>{if(Date.now()-lastSave>5000){lastSave=Date.now();savePlayer()}});
$("#completeBtn").onclick=()=>{if(!selected)return;persist(selected.id,{completed:!selected.completed,progress:!selected.completed?100:selected.progress});updateCompleteButton()};
let noteTimer;$("#notes").addEventListener("input",e=>{clearTimeout(noteTimer);const value=e.target.value;noteTimer=setTimeout(()=>selected&&persist(selected.id,{notes:value},true),300)});
$("#continueBtn").onclick=()=>{const l=findLesson(localStorage.getItem(`${STORAGE_KEY}-last`));if(l)selectLesson(l,true)};

// New Features: Sidebar toggle, Expand/Collapse all, Playback controls, Keyboard shortcuts
$("#toggleSidebarBtn").onclick = () => {
  $(".layout").classList.toggle("sidebar-collapsed");
  const isCollapsed = $(".layout").classList.contains("sidebar-collapsed");
  $("#toggleSidebarBtn").textContent = isCollapsed ? "📖" : "☰";
};

$("#expandAllBtn").onclick = () => {
  document.querySelectorAll(".tree-section").forEach(s => s.classList.add("open"));
};

$("#collapseAllBtn").onclick = () => {
  document.querySelectorAll(".tree-section").forEach(s => s.classList.remove("open"));
};

$("#playbackSpeed").onchange = (e) => {
  const p = $("#videoPlayer");
  if(p) p.playbackRate = parseFloat(e.target.value);
};

$("#pipBtn").onclick = async () => {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await $("#videoPlayer").requestPictureInPicture();
    }
  } catch(e) {}
};

window.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  const p = $("#videoPlayer");
  if (!p || p.hidden) return;
  
  switch(e.code) {
    case "Space":
    case "KeyK":
      if (document.activeElement && document.activeElement.tagName === "BUTTON") document.activeElement.blur();
      e.preventDefault();
      p.paused ? p.play() : p.pause();
      break;
    case "KeyF":
      e.preventDefault();
      if (!document.fullscreenElement) {
        p.requestFullscreen().catch(()=>{});
      } else {
        document.exitFullscreen();
      }
      break;
    case "ArrowLeft":
      e.preventDefault();
      p.currentTime = Math.max(0, p.currentTime - 10);
      break;
    case "ArrowRight":
      e.preventDefault();
      p.currentTime = Math.min(p.duration, p.currentTime + 10);
      break;
  }
});

window.addEventListener("beforeunload",()=>{savePlayer();revoke()});
