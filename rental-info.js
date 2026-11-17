/* Prado rental local info. Client-only; no visitor data is transmitted to a CRM.
   Weather from Open-Meteo (not a government weather service), with official
   alerts provided as outbound sources. Never fabricate a live road status. */
(function(){
 "use strict";
 const city = { latitude: "-17.3411", longitude: "-39.2208" }; // Prado city, consistent with TaxiPrado weather location
 const $ = id => document.getElementById(id);
 const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value);
 const fmtTime = time => typeof time === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(time) ? time.replace("T"," às ") : "horário não disponível";
 function labelWmo(code) {
   if(code===0) return "Céu limpo";
   if(code>=1 && code<=3) return "Nuvens variáveis";
   if(code>=45 && code<=48) return "Neblina";
   if(code>=51 && code<=67) return "Chuva ou garoa";
   if(code>=80 && code<=82) return "Pancadas de chuva";
   if(code>=95) return "Trovoadas";
   return "Tempo variável";
 }
 const weatherURL = "https://api.open-meteo.com/v1/forecast?"+
    new URLSearchParams({latitude:city.latitude,longitude:city.longitude,
    current:"temperature_2m,weather_code,wind_speed_10m",
    daily:"temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone:"America/Bahia",forecast_days:"3"}).toString();
 let lastFetchMs=0, inFlight=false;
 async function loadWeather(force=false) {
   const status=$("live-weather-status"), temperature=$("live-weather-temp"), description=$("live-weather-summary");
   const wind=$("live-weather-wind"), rain=$("live-weather-rain"), updated=$("live-weather-updated");
   if(!status||!temperature||!description||inFlight) return;
   if(!force && Date.now()-lastFetchMs<15*60*1000) return;
   inFlight=true;lastFetchMs=Date.now();status.textContent="Consultando previsão meteorológica...";
   const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),8500);
   try {
     const response=await fetch(weatherURL,{signal:controller.signal,cache:"no-store",headers:{Accept:"application/json"}});
     if(!response.ok)throw new Error("meteorologia");
     const data=await response.json(),cur=data?.current, daily=data?.daily;
     if(!cur || typeof cur.temperature_2m!=="number" || !cur.time)throw new Error("dados incompletos");
     const timeStr=String(cur.time);
     const observed=new Date(timeStr+"-03:00");
     if(!Number.isFinite(observed.getTime())||Math.abs(Date.now()-observed.getTime())>3*3600*1000)throw new Error("previsão desatualizada");
     temperature.textContent=Math.round(cur.temperature_2m)+"°C";
     description.textContent=labelWmo(cur.weather_code);
     wind.textContent=Number.isFinite(cur.wind_speed_10m)?Math.round(cur.wind_speed_10m)+" km/h":"Indisponível";
     rain.textContent=Number.isFinite(daily?.precipitation_probability_max?.[0]) ? Math.round(daily.precipitation_probability_max[0])+"% (máx. hoje)" : "Indisponível";
     updated.textContent="Modelo para Prado: "+fmtTime(timeStr)+" (horário da Bahia)";
     status.textContent="Previsão atualizada; pode mudar sem aviso.";
     status.dataset.state="ok";
   }catch(e) {
     temperature.textContent="—";
     description.textContent="Previsão indisponível";
     wind.textContent="—";
     rain.textContent="—";
     updated.textContent="Sem horário válido";
     status.textContent="Não foi possível atualizar a previsão. Confira os alertas oficiais antes de viajar.";
     status.dataset.state="unavailable";
   }finally{clearTimeout(timeout);inFlight=false;}
 }
 function syncedReturn() {
   const pickup=$("pickup"),returnTo=$("return-place");
   if(pickup&&returnTo&&returnTo.dataset.changed!=="true")returnTo.value=pickup.value;
 }
 function setupRentalExtras(){
   $("pickup")?.addEventListener("change",syncedReturn);
   $("return-place")?.addEventListener("change",()=>{$("return-place").dataset.changed="true"});
   // Retain V2 core form, without claiming a confirmed booking.
   const form=$("search-form");
   if(form)form.addEventListener("submit",()=>{
     const a=$("datefrom")?.value,b=$("dateto")?.value;
     if(!validDate(a)||!validDate(b)||b<=a) return;
     const summary=$("rental-criteria");
     if(summary){
       const details=[
         $("pickup")?.value,
         $("return-place")?.value!==$("pickup")?.value?"devolução em "+$("return-place")?.value:"mesmo local de devolução",
         $("timefrom")?.value||"horário a definir",
         $("driver-age")?.value||"idade a confirmar"
       ];
       summary.textContent="Busca demonstrativa: "+details.filter(Boolean).join(" · ")+". Sem consulta real de disponibilidade.";
     }
   });
   const modal=$("quoteOverlay");
   const modalFrom=$("dialogFrom"),modalTo=$("dialogTo");
   const initial=window.openQuote;
   if(typeof initial==="function")window.openQuote=function(category){
     initial(category);
     const place=$("dialogPlace")?.value,ret=$("dialogReturnPlace");
     if(ret) ret.value=$("return-place")?.value || place || "Prado";
     if($("dialogPickupTime"))$("dialogPickupTime").value=$("timefrom")?.value||"09:00";
     if($("dialogReturnTime"))$("dialogReturnTime").value=$("timeto")?.value||"09:00";
     if($("dialogAge"))$("dialogAge").value=$("driver-age")?.value||"25-69";
   };
   if(modal&&modalFrom&&modalTo)modal.addEventListener("change",e=>{
     if(e.target===modalFrom && modalTo.value<modalFrom.value)modalTo.value=modalFrom.value;
   });
   // Local demo only. No personal contact fields and no submission endpoint.
   $("rental-demo-notice")?.addEventListener("click",()=>window.openQuote?.());
   loadWeather();
   document.addEventListener("visibilitychange",()=>{if(!document.hidden)loadWeather()});
   setInterval(()=>{if(!document.hidden)loadWeather()},15*60*1000);
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setupRentalExtras,{once:true});
 else setupRentalExtras();
})();
