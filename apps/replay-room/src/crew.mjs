import {createElement, useEffect, useRef} from "react";
import {mountReplayRoom} from "./room.mjs";
import lessons from "./lessons.json";
import css from "./room.css";

export default function ReplayRoom() {
  const container = useRef(null);
  useEffect(() => mountReplayRoom(container.current, lessons, {
    gameUrl: "https://alejandro-publius.github.io/cowboys-vs-wizards/",
  }), []);
  return createElement("div", null, createElement("style", null, css), createElement("div", {ref: container}));
}
