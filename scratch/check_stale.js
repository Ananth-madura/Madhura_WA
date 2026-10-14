const s = require("fs").readFileSync("D:/Whatsapp_CRM/landing_page/src/LandingPage.jsx", "utf8");
console.log('dead href="# anchors:', (s.match(/href="#/g) || []).length);
console.log("localhost:3000 refs:", (s.match(/localhost:3000/g) || []).length);
console.log("size:", s.length);
console.log("referenced anywhere:", require("fs").existsSync("D:/Whatsapp_CRM/landing_page/src/App.jsx") ? "check grep" : "?");
