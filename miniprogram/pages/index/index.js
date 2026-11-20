const DB = require("../../data/articles.js");

Page({
  data: {
    trips: []
  },
  onLoad() {
    this.setData({ trips: DB.trips });
  },
  open(e) {
    wx.navigateTo({
      url: `/pages/trip/trip?id=${e.currentTarget.dataset.id}`
    });
  },
  openMap() {
    wx.navigateTo({ url: "/pages/map/map" });
  },
  openJourney() {
    wx.navigateTo({ url: "/pages/journey/journey" });
  }
});
