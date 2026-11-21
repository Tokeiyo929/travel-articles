const DB = require("../../data/articles.js");

Page({
  data: {
    visited: [],
    cityCount: 0,
    countryCount: 0,
    routesSrc: ""
  },
  onLoad() {
    const visited = DB.visited || [];
    this.setData({
      visited,
      cityCount: visited.length,
      countryCount: new Set(visited.map((c) => c.country).filter(Boolean)).size,
      routesSrc: DB.routesSvg || ""
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
