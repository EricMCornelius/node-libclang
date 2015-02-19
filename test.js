#!/usr/bin/env node

var clang = require('./index');

var ctx = clang.createIndex(false, true);
var tu = clang.parseTranslationUnit(ctx, 'test.cpp', [], 0);
var file = clang.getFile(tu, 'test.cpp');
var name = clang.getFileName(file);
var str = clang.getCString(name);
console.log(str);
clang.disposeString(name);

var cursor = clang.getTranslationUnitCursor(tu);
var spelling = clang.getCursorSpelling(cursor);
str = clang.getCString(spelling);
console.log(str);
clang.disposeString(spelling);

/*
  visitChildren(getTranslationUnitCursor(tu), visitor, nullptr);

  disposeTranslationUnit(tu);
  disposeIndex(ctx);
*/
