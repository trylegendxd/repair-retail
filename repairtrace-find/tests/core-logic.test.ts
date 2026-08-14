import test from "node:test";
import assert from "node:assert/strict";
import { deviceModels, getIssue, getModel, inferIssueFromProblem, modelKeyFromLabel, searchDeviceModels } from "../lib/repair-catalog.ts";
import { deviceCatalogSize, searchAllDeviceModels } from "../lib/device-catalog.server.ts";

test("custom models use the same privacy-safe slug format as workshop sync",()=>{
  assert.equal(modelKeyFromLabel("Xiaomi Redmi Note 13+"),"xiaomi-redmi-note-13plus");
  assert.deepEqual(getModel("other","Xiaomi Redmi Note 13+","Phone"),{
    key:"xiaomi-redmi-note-13plus",label:"Xiaomi Redmi Note 13+",brand:"Xiaomi",category:"Phone",factor:1,
  });
});

test("an incompatible repair issue falls back to diagnosis",()=>{
  assert.equal(getIssue("screen","Audio").key,"diagnostic");
});

test("the device catalog is broad and ranks partial model queries",()=>{
  assert.ok(deviceModels.length>=150);
  assert.equal(searchDeviceModels("ps5 slim")[0]?.label,"PlayStation 5 Slim");
  assert.equal(searchDeviceModels("redmi note 13 pro plus")[0]?.label,"Xiaomi Redmi Note 13 Pro+");
  assert.equal(searchDeviceModels("macbook m3 15")[0]?.label,"MacBook Air M3 15-inch");
});

test("the source-backed catalogue covers tens of thousands of additional devices",()=>{
  assert.ok(deviceCatalogSize>=20_000);
  const pixel=searchAllDeviceModels("Pixel 10a",5).find(model=>model.label.includes("Pixel 10a"));
  assert.equal(pixel?.source,"google-play");
  assert.equal(searchAllDeviceModels("SM-S921E",5)[0]?.label,"Samsung Galaxy S24");
});

test("free-form customer problems are classified only into compatible repairs",()=>{
  assert.equal(inferIssueFromProblem("The screen cracked and touch no longer works","Phone"),"screen");
  assert.equal(inferIssueFromProblem("The console screen is broken","Console"),"screen");
  assert.equal(inferIssueFromProblem("It fell into water yesterday","Camera"),"liquid");
  assert.equal(inferIssueFromProblem("The HDMI port has no picture","Console"),"video");
  assert.equal(inferIssueFromProblem("The drone gimbal is stuck","Drone"),"lens");
});
