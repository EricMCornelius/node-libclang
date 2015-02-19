#!/usr/bin/env node

var clang = require('./index');

var ctx = clang.clang_createIndex(false, true);
var tu = clang.clang_parseTranslationUnit(ctx, 'test.cpp', [], 0);
var file = clang.clang_getFile(tu, 'test.cpp');
var name = clang.clang_getFileName(file);
var str = clang.clang_getCString(name);
console.log(str);
clang.clang_disposeString(name);

var cursor = clang.clang_getTranslationUnitCursor(tu);
var spelling = clang.clang_getCursorSpelling(cursor);
str = clang.clang_getCString(spelling);
console.log(str);
clang.clang_disposeString(spelling);

/*
  clang_visitChildren(clang_getTranslationUnitCursor(tu), visitor, nullptr);

  clang_disposeTranslationUnit(tu);
  clang_disposeIndex(ctx);
*/
