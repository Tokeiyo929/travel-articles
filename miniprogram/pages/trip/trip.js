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
    this.setData({ trip });
  },

  back() {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.reLaunch({ url: "/pages/index/index" });
  },

  onShareAppMessage() {
    const trip = this.data.trip;
    return {
      title: trip.title,
      imageUrl: trip.cover
    };
  }
});
