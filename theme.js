/* Light/dark toggle: remembers the choice, falls back to the OS setting */
(function(){
  var root=document.documentElement;
  try{var saved=localStorage.getItem("theme");if(saved)root.setAttribute("data-theme",saved);}catch(e){}
  document.addEventListener("DOMContentLoaded",function(){
    var btn=document.getElementById("theme-toggle");if(!btn)return;
    function current(){return root.getAttribute("data-theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");}
    function sync(){var dark=current()==="dark";btn.setAttribute("aria-pressed",String(dark));btn.querySelector("span").textContent=dark?"Dark":"Light";}
    sync();
    btn.addEventListener("click",function(){
      var next=current()==="dark"?"light":"dark";
      root.setAttribute("data-theme",next);
      try{localStorage.setItem("theme",next);}catch(e){}
      sync();
    });
  });
})();
