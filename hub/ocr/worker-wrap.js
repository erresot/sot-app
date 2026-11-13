importScripts('lang/por-data.js');
(function(){var _f=self.fetch.bind(self);var bin=null;
self.fetch=function(u,o){if(String(u).indexOf('por.traineddata')>=0){if(!bin){var s=atob(self.POR_GZ_B64),a=new Uint8Array(s.length);for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i);bin=a}return Promise.resolve(new Response(bin.slice(0)))}return _f(u,o)};})();
importScripts('worker.min.js');
