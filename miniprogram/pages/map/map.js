const DB = require("../../data/articles.js");

Page({
  data: {
    visited: [],
    cityCount: 0,
    countryCount: 0
  },
  onLoad() {
    const visited = DB.visited || [];
    this.setData({
      visited,
      cityCount: visited.length,
      countryCount: new Set(visited.map((c) => c.country).filter(Boolean)).size
    });
  },
  openTrip(e) {
    const trip = e.currentTarget.dataset.trip;
    if (trip) wx.navigateTo({ url: `/pages/trip/trip?id=${trip}` });
  }
});
