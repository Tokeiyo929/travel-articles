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

  // 竖图在横屏里不该通栏：按加载到的宽高比切换为限高 contain 模式
  onImgLoad(e) {
    const { width, height } = e.detail;
    if (!width || !height) return;
    const idx = e.currentTarget.dataset.idx;
    this.setData({ [`trip.blocks[${idx}].ratio`]: width / height });
  },

  onShareAppMessage() {
    const trip = this.data.trip;
    return {
      title: trip.title,
      imageUrl: trip.cover
    };
  }
});
