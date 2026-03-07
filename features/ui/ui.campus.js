const { t } = require("../../lib/i18n");

function getCampusServices(lang = "ko") {
  return [
    {
      id: "building_map",
      title: t("campus.buildingMap.title", lang),
      emoji: "🏢",
      actionType: "route",
      actionValue: "/map/hssc",
      enabled: true,
    },
    {
      id: "building_code",
      title: t("campus.buildingCode.title", lang),
      emoji: "🔢",
      actionType: "route",
      actionValue: "/search",
      enabled: true,
    },
    {
      id: "lost_found",
      title: t("campus.lostFound.title", lang),
      emoji: "🧳",
      actionType: "webview",
      actionValue: "https://webview.skkuuniverse.com/#/skku/lostandfound",
      webviewTitle: t("campus.lostFound.title", lang),
      webviewColor: "003626",
      enabled: true,
    },
    {
      id: "inquiry",
      title: t("campus.inquiry.title", lang),
      emoji: "💬",
      actionType: "external",
      actionValue: "http://pf.kakao.com/_cjxexdG/chat",
      enabled: true,
    },
  ];
}

module.exports = { getCampusServices };
