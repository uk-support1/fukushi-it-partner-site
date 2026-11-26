// 得意の交換ページ：家族4人×10種類のお寿司を、交換前・交換後で並べて描く
(function () {
  var NETA = ["マグロ", "サーモン", "エビ", "イクラ", "タマゴ", "イカ", "ウニ", "ハマチ", "ホタテ", "アナゴ"];
  var FAMILY = [
    { name: "お父さん", love: ["エビ"], give: ["イクラ"], after: { "エビ": 2, "イクラ": 0 } },
    { name: "お母さん", love: ["ウニ"], give: ["マグロ"], after: { "ウニ": 2, "マグロ": 0 } },
    { name: "娘", love: ["イクラ", "タマゴ"], give: ["エビ", "サーモン"], after: { "イクラ": 2, "タマゴ": 2, "エビ": 0, "サーモン": 0 } },
    { name: "息子", love: ["マグロ", "サーモン"], give: ["ウニ", "タマゴ"], after: { "マグロ": 2, "サーモン": 2, "ウニ": 0, "タマゴ": 0 } }
  ];

  function chip(neta, kind, label) {
    var el = document.createElement("li");
    el.className = "th-chip th-chip--" + kind;
    el.textContent = label || neta;
    return el;
  }

  document.querySelectorAll("[data-sushi]").forEach(function (box) {
    var mode = box.getAttribute("data-sushi");
    FAMILY.forEach(function (p) {
      var row = document.createElement("div");
      row.className = "th-person";
      var name = document.createElement("p");
      name.className = "th-person-name";
      name.textContent = p.name;
      var list = document.createElement("ul");
      list.className = "th-plate";
      var desc = [];
      NETA.forEach(function (n) {
        var isLove = p.love.indexOf(n) !== -1;
        var isGive = p.give.indexOf(n) !== -1;
        var count = mode === "after" && n in p.after ? p.after[n] : 1;
        if (count === 0) {
          list.appendChild(chip(n, "gone"));
        } else if (isLove) {
          for (var i = 0; i < count; i++) list.appendChild(chip(n, "love"));
          if (count > 1) desc.push(n + count + "貫");
        } else if (isGive) {
          list.appendChild(chip(n, "give"));
        } else {
          list.appendChild(chip(n, "plain"));
        }
      });
      list.setAttribute("aria-label", p.name + "：" + (mode === "after" ? "大好きな" + desc.join("・") + "を含む10貫" : "10種類を1貫ずつ（大好きな" + p.love.join("・") + "も1貫、苦手・ゆずれる" + p.give.join("・") + "も1貫）"));
      row.appendChild(name);
      row.appendChild(list);
      box.appendChild(row);
    });
  });
})();
