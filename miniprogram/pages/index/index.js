const DB = require("../../data/articles.js");

Page({
  data: {
    visited: [],
    cityCount: 0,
    countryCount: 0,
    routesSrc: "",
    mapW: 0,
    mapH: 0,
    initX: 0,
    initY: 0
  },
  onLoad() {
    const visited = DB.visited || [];
    const sys = wx.getSystemInfoSync();
    const winW = sys.windowWidth;
    const winH = sys.windowHeight;
    // 放大版地图：宽 = 屏宽 2.4 倍（等距圆柱 2:1），可拖动查看细节
    const mapW = Math.round(winW * 2.4);
    const mapH = Math.round(mapW / 2);

    // 初始对准用户足迹区（东经 ~100°，北纬 ~35°）：
    // 经度 100°E → x% = (100+180)/360 ≈ 77.8%；纬度 35°N → y% = (90-35)/180 ≈ 30.6%
    const focusX = 0.778;
    const focusY = 0.306;
    const maxX = mapW - winW; // 内容可左移的最大量
    const maxY = mapH - winH;
    let initX = -(focusX * mapW - winW / 2);
    let initY = -(focusY * mapH - winH / 2);
    initX = Math.max(Math.min(initX, 0), -maxX);
    initY = Math.max(Math.min(initY, 0), -maxY);

    this.setData({
      visited,
      cityCount: visited.length,
      countryCount: new Set(visited.map((c) => c.country).filter(Boolean)).size,
      routesSrc: DB.routesSvg || "",
      mapW,
      mapH,
      initX: Math.round(initX),
      initY: Math.round(initY)
    });
  },
  // 点城市标记：有手帖的进游记，没有的提示坐标已记
  openCity(e) {
    const trip = e.currentTarget.dataset.trip;
    const name = e.currentTarget.dataset.name || "此城";
    if (trip) {
      wx.navigateTo({ url: `/pages/trip/trip?id=${trip}` });
    } else {
      wx.showToast({ title: `${name} · 手帖未至`, icon: "none" });
    }
  }
});
