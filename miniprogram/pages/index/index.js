const DB = require("../../data/articles.js");

Page({
  data: {
    visited: [],
    cityCount: 0,
    countryCount: 0,
    routesSrc: "",
    mapW: 0,
    mapH: 0,
    areaW: 0,
    areaH: 0,
    focusX: 0.778,  // 东经 ~100°（足迹区中心）
    focusY: 0.306   // 北纬 ~35°
  },
  onLoad() {
    const visited = DB.visited || [];
    const sys = wx.getSystemInfoSync();
    const areaW = sys.windowWidth;
    const areaH = sys.windowHeight;
    // 放大版地图：宽 = 屏宽 2.4 倍（等距圆柱 2:1），WXS 手势层负责拖动缩放
    const mapW = Math.round(areaW * 2.4);
    const mapH = Math.round(mapW / 2);

    this.setData({
      visited,
      cityCount: visited.length,
      countryCount: new Set(visited.map((c) => c.country).filter(Boolean)).size,
      routesSrc: DB.routesSvg || "",
      mapW,
      mapH,
      areaW,
      areaH
    });
  },
  // 点城市标记（WXS 手势层不拦截 tap）：有手帖进游记，没有则提示
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
