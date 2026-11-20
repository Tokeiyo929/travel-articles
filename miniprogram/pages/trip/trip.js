const DB = require("../../data/articles.js");

Page({
  data: {
    trip: null
  },
  onLoad(options) {
    const trip = DB.articles[String(options.id || "1")];
    if (!trip) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }
    wx.setNavigationBarTitle({ title: trip.title });
    this.setData({ trip });
  },

  onShareAppMessage() {
    const trip = this.data.trip;
    return {
      title: trip.title,
      imageUrl: trip.cover
    };
  }
});
