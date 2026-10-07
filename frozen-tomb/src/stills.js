const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();
const fs=require('fs');
(async()=>{
  const b=await chromium.launch({args:['--disable-web-security','--allow-file-access-from-files']});
  const p=await b.newPage({viewport:process.env.VERT?{width:1080,height:1920}:{width:1920,height:1080}});
  p.on('console',m=>console.log('console:',m.text())); p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('file://'+__dirname+'/film/index.html'+(process.env.VERT?'?v':''));
  await p.evaluate(()=>window.ready);
  const times=process.argv.slice(2).map(Number);
  fs.mkdirSync('stills',{recursive:true});
  for(const t of times){
    await p.evaluate(t=>render(t),t);
    const d=await p.evaluate(()=>document.getElementById('c').toDataURL('image/jpeg',.85));
    fs.writeFileSync('stills/'+(process.env.VERT?'v':'')+'s_'+t.toFixed(2)+'.jpg',Buffer.from(d.split(',')[1],'base64'));
  }
  if(process.env.EV) fs.writeFileSync('events.json',JSON.stringify(await p.evaluate(()=>({ev:window.EVENTS,T:window.TIMES,RW:window.RW}))));
  await b.close();
})();
