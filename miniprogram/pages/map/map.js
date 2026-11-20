const DB = require("../../data/articles.js");

Page({
  data: {
    visited: [],
    cityCount: 0,
    countryCount: 0,
    journeyCount: 0,
    routesSrc: ""
  },
  onLoad() {
    const visited = DB.visited || [];
    const journeys = DB.journeys || [];
    this.setData({
      visited,
      cityCount: visited.length,
      countryCount: new Set(visited.map((c) => c.country).filter(Boolean)).size,
      journeyCount: journeys.length,
      routesSrc: DB.routesSvg || ""
    });
  },
  openTrip(e) {
    const trip = e.currentTarget.dataset.trip;
    if (trip) wx.navigateTo({ url: `/pages/trip/trip?id=${trip}` });
  },
  goJourney() {
    wx.navigateTo({ url: "/pages/journey/journey" });
  }
});
