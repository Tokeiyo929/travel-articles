const DB = require("../../data/articles.js");

Page({
  data: {
    journeys: [],
    modeLabel: {}
  },
  onLoad() {
    this.setData({
      journeys: DB.journeys || [],
      modeLabel: DB.modeLabel || {}
    });
  },
  openTrip(e) {
    const trip = e.currentTarget.dataset.trip;
    if (trip) wx.navigateTo({ url: `/pages/trip/trip?id=${trip}` });
  },
  openMap() {
    wx.navigateTo({ url: "/pages/map/map" });
  }
});
