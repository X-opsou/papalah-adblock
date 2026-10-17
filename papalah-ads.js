/**
 * papalah-ads.js — Surge http-response script
 * 去除 papalah.com 的横幅 / 悬浮 / 内嵌 / 弹窗跳转 / 视频贴片广告，并绕过站点的反广告拦截检测。
 * 运行环境：Surge iOS（JavaScriptCore），保持 ES5 语法。
 */
(function () {
  var resp = typeof $response !== "undefined" ? $response : null;
  if (!resp || !resp.body) {
    $done({});
    return;
  }

  var body = resp.body;
  var headers = resp.headers || {};
  var ct = (headers["Content-Type"] || headers["content-type"] || "").toLowerCase();
  if (ct.indexOf("html") === -1) {
    $done({});
    return;
  }

  // 广告域名（同时用于 Surge 规则的补充兜底）
  var AD_RE = /(magsrv\.com|exoclick\.com|exosrv\.com|exdynsrv\.com|jads\.co|juicyads\.(?:com|net)|tsyndicate\.(?:com|net)|adxadserv\.com|yellowishgather\.com|amon1\.net|boxypluckunrelated\.com|farflungeffective\.com|marzaent\.com|janusaent\.com|pncloudfl\.com|doppiocdn\.com|silent-basis\.pro|irresponsible-smoke\.com|freeserviceplays\.com|stbuttons\.click|bkcdn\.net|cdn-fc\.com|pxltag\.com|uuidksinc\.net|mavrtracktor\.com|adsterra\.com|popads\.net|popcash\.net|propellerads\.com|clickadu\.com|hilltopads\.net|trafficjunky\.net|adnium\.com|plugrush\.com|ero-advertising\.com|adspyglass\.com|adcash\.com)/i;

  // 1) 移除广告 <script>（外链 src、内联 loader 或内联广告队列 push）；播放器初始化脚本只精准删掉 VAST 调用
  body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, function (tag) {
    // 站点反广告拦截检测：整段移除
    if (/justDetectAdblock|adBlockDetected\s*\(/.test(tag)) return "";
    // 广告关键字：广告域名 / 广告队列 / 广告位属性
    if (!AD_RE.test(tag) && !/adsbyjuicy|adsbyexoclick|AdProvider\s*=|data-ts-spot|data-adxad-place/i.test(tag)) return tag;
    if (/videojs\s*\(/.test(tag) || /querySelector\(\s*['"]source/.test(tag)) {
      return stripVast(tag);
    }
    return "";
  });

  // 2) 播放器内联脚本：去掉 video.vast({...}) 贴片广告初始化（保留其余播放逻辑）
  function stripVast(tag) {
    return tag.replace(/video\s*\.\s*vast\s*\(\s*\{[^{}]*\}\s*\)\s*;?/gi, "");
  }

  // 3) 移除广告占位标签 <ins>（JuicyAds / ExoClick / TrafficStars）
  body = body.replace(/<ins\b[^>]*>[\s\S]*?<\/ins>/gi, "");
  body = body.replace(/<ins\b[^>]*\/>/gi, "");

  // 4) 移除广告 iframe
  body = body.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, function (tag) {
    return AD_RE.test(tag) ? "" : tag;
  });

  // 5) 移除带 sponsored 标记的推广直链（含关键字直链）与弹窗广告的假关闭按钮
  body = body.replace(/<a\b[^>]*\brel\s*=\s*["'][^"']*sponsored[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, "");
  body = body.replace(/<a\b[^>]*\bclass\s*=\s*["'][^"']*timer_close[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, "");

  // 6) 注入隐藏样式 + 运行时守卫（拦截弹出窗口、清掉动态注入的广告节点）
  var CSS = [
    ".banner,.sponsor-outer,.item-ads,.pop-ads-control,.timer_close,#companion,.rmp-container,",
    "ins.adsbyexoclick,ins.adsbyjuicy,ins[class^=\"eas\"],",
    "iframe[src*=\"magsrv\"],iframe[src*=\"jads\"],iframe[src*=\"tsyndicate\"],",
    "iframe[src*=\"adxadserv\"],iframe[src*=\"yellowishgather\"],",
    "a[rel~=\"sponsored\"],#eZpvzakmotcB{display:none!important;width:0!important;height:0!important;",
    "margin:0!important;padding:0!important;border:0!important}"
  ].join("");

  var GUARD = "(function(){if(window.__hermesPapaAd)return;window.__hermesPapaAd=1;" +
    "var AD=/(magsrv\\.com|exoclick\\.com|jads\\.co|juicyads|tsyndicate|adxadserv|yellowishgather|amon1\\.net|bkcdn\\.net|cdn-fc\\.com|marzaent\\.com|janusaent\\.com|pncloudfl\\.com|doppiocdn\\.com|stbuttons\\.click|freeserviceplays\\.com|mavrtracktor\\.com|pxltag\\.com|uuidksinc\\.net)/i;" +
    "var SEL='.banner,.sponsor-outer,.item-ads,.pop-ads-control,.timer_close,#companion,.rmp-container,ins,.adsbyjuicy,.adsbyexoclick,a[rel~=\"sponsored\"],#eZpvzakmotcB,div[class*=\"\\u25b6\"]';" +
    "function floatClose(){try{var ns=document.querySelectorAll('a,button,div,span');for(var i=ns.length-1;i>=0;i--){var el=ns[i];if(el.childElementCount>0)continue;var t=(el.textContent||'').trim();if(t.indexOf('\\u95dc\\u9589')<0&&t.indexOf('\\u5173\\u95ed')<0)continue;var s=getComputedStyle(el);if(s.position!=='static'||/timer_close/.test(el.className||'')){kill(el);}}}catch(e){}}" +
    "function kill(e){if(e&&e.parentNode){e.parentNode.removeChild(e);}}" +
    "function scan(root){if(!root||!root.querySelectorAll)return;try{var ns=root.querySelectorAll(SEL);for(var i=ns.length-1;i>=0;i--){kill(ns[i]);}" +
    "var fr=root.querySelectorAll('iframe');for(var j=fr.length-1;j>=0;j--){if(AD.test(fr[j].getAttribute('src')||''))kill(fr[j]);}" +
    "}catch(e){}}" +
    "var open=window.open;window.open=function(u){try{if(!u)return null;var h=String(u).replace(/^https?:\\/\\//i,'').split('/')[0].split(':')[0];" +
    "if(!/(^|\\.)(papalah\\.com|aiailah\\.com|sslah\\.com)$/i.test(h)){console.log('[hermes-adblock] popup blocked:',u);return null;}}catch(e){return null;}return open.apply(window,arguments);};" +
    "try{var ac=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){try{var hn=this.hostname||'';if(hn&&hn!==location.hostname){console.log('[hermes-adblock] anchor popup blocked:',this.href);return;}}catch(e){}return ac.apply(this,arguments);};}catch(e){}" +
    "document.addEventListener('click',function(e){try{var el=e.target,a=null;while(el&&el!==document){if(el.tagName==='A'&&el.href){a=el;break;}el=el.parentNode;}if(!a)return;var hn=a.hostname||'';if(hn&&hn!==location.hostname&&!/(^|\\.)(papalah\\.com|aiailah\\.com|sslah\\.com|aalah\\.me)$/i.test(hn)){e.preventDefault();e.stopPropagation();console.log('[hermes-adblock] click hijack blocked:',a.href);}}catch(err){}},true);" +
    "function boot(){scan(document);floatClose();if(window.MutationObserver){var mo=new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var m=ms[i];if(m.addedNodes){for(var k=0;k<m.addedNodes.length;k++){var n=m.addedNodes[k];if(n.nodeType===1){scan(n);if(AD.test(n.tagName==='IFRAME'?(n.getAttribute('src')||''):''))kill(n);}}}}});mo.observe(document.documentElement,{childList:true,subtree:true});}setInterval(function(){scan(document);floatClose();},2000);}" +
    "if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',boot);}else{boot();}})();";

  var inject = "<style id=\"hermes-papalah-adblock\">" + CSS + "</style>" +
    "<script type=\"text/javascript\">" + GUARD + "<\/script>";

  if (/<\/head>/i.test(body)) {
    body = body.replace(/<\/head>/i, inject + "</head>");
  } else if (/<body[^>]*>/i.test(body)) {
    body = body.replace(/<body[^>]*>/i, function (m) { return m + inject; });
  } else {
    body = inject + body;
  }

  $done({ body: body });
})();
