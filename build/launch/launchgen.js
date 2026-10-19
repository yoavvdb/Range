// Regenerates the iPhone launch images: needs splash_test.html next to it (the page <style> plus the #splash markup from range.html) and Playwright. Run with node, then build.py.
const {chromium}=require('playwright');
// [css w, css h, dpr, safe top, safe bottom]
const D=[[440,956,3,62,34],[402,874,3,62,34],[430,932,3,59,34],[393,852,3,59,34],[428,926,3,47,34],[390,844,3,47,34],[375,812,3,44,34],[414,896,3,44,34],[414,896,2,48,34],[414,736,3,20,0],[375,667,2,20,0]];
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});const out=[];
for(const [w,h,r,t,bt] of D){const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:r});
await p.goto('file://'+__dirname+'/splash_test.html');await p.addStyleTag({content:`#splash{padding:${t}px 0 ${bt}px!important}`});
await p.evaluate(()=>document.getAnimations().forEach(a=>{a.pause();a.currentTime=0}));
const f=`launch-${w*r}x${h*r}.png`;await p.screenshot({path:'/home/user/range-repo/build/launch/'+f});
out.push(`<link rel="apple-touch-startup-image" href="${f}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)">`);await p.close()}
require('fs').writeFileSync('/home/user/range-repo/build/launch/links.html',out.join('\n')+'\n');await b.close()})();
