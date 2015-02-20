#!/usr/bin/env node

var fs = require('fs');
var _ = require('lodash');

var source = 'libclang';
var binding = source + '_binding';

var input = './' + (process.argv[2] || `${source}.json`);
var info = require(input);

var headerfile = fs.createWriteStream(`src/${binding}.h`);
var sourcefile = fs.createWriteStream(`src/${binding}.cc`);

var failed_functions = {};
var unique_idx = 0;

function getType(t) {
  if (t.pointer) {
    return getType(t.type) + '*';
  }
  if (t.rvalue_reference || t.lvalue_reference) {
    return 'complex';
  }
  if (t.type) {
    return getType(t.type);
  }
  return t;
}

function generateArgAccessor(f, a, idx) {
  if (a.name === '') {
    a.name = 'gen' + (++unique_idx);
  }

  var t = getType(a);
  var template = (t.indexOf('*') !== -1) ? `  auto _${a.name} = ` : `  auto ${a.name} = `;

  var rhs = 'args[' + idx + ']';
  if (t.indexOf('struct') === 0) {
    var typename = t.slice(7);
    t = 'struct';
  }
  else if(t.indexOf('enum') === 0) {
    var typename = t.slice(5);
    t = 'enum';
    if (typename.indexOf(' ') !== -1 || typename.indexOf('*') !== -1) {
      t = 'complex';
    }
  }
  else {
    typename = t;
  }

  switch (t) {
    case 'unsigned':
    case 'unsigned int':
    case 'unsigned short':
    case 'unsigned char':
      rhs += '->Uint32Value();';
      break;
    case 'long':
      rhs += '->IntegerValue();';
      break;
    case 'unsigned long':
    case 'unsigned long long':
      rhs += '->IntegerValue();';
      break;
    case 'int':
    case 'short':
    case 'char':
    case 'signed char':
      rhs += '->Int32Value();';
      break;
    case 'bool':
      rhs += '->BooleanValue();';
      break;
    case 'double':
    case 'float':
      rhs += '->NumberValue();';
      break;
    case 'char*':
      template = `  NanAsciiString _${a.name}(args[${idx}]->ToString());\n`;
      rhs = `  auto ${a.name} = *_${a.name};`;
      break;
    case 'char**':
      template =
`  auto _${a.name} = Local<Array>::Cast(${rhs});
  std::vector<std::unique_ptr<NanAsciiString>> _${a.name}_strs;
  std::vector<const char*> _${a.name}_args;
  for (auto idx = 0u; idx < _${a.name}->Length(); ++idx) {
    _${a.name}_strs.emplace_back(new NanAsciiString(_${a.name}->Get(idx)->ToString()));
  }
  for (auto& elem : _${a.name}_strs) {
    _${a.name}_args.emplace_back(**elem);
  }
  auto ${a.name} = &_${a.name}_args[0];
`
      rhs = '';
      break;
    case 'long*':
    case 'unsigned long*':
    case 'int*':
    case 'unsigned int*':
    case 'short*':
    case 'unsigned short*':
    case 'float*':
    case 'double*':
    case 'unsigned char*':
    case 'signed char*':
      rhs += '->ToObject();\n';
      rhs += `  auto ${a.name} = reinterpret_cast<${t}>(node::Buffer::Data(_${a.name}));`;
      // node::Buffer::HasInstance(val))
      // node::Buffer::Data(val);
      // node::Buffer::Length(val);
      break;
    case 'void*':
      template = `  auto ${a.name} = NanGetInternalFieldPointer(${rhs}->ToObject(), 0);`
      rhs = '';
      break;
    case 'struct':
      if (typename.indexOf('*') !== -1) {
        template =
`
  auto ${a.name} = ${rhs}->IsObject() ?
    reinterpret_cast<${typename}>(NanGetInternalFieldPointer(${rhs}->ToObject(), 0)) :
    nullptr;
`;
        rhs = '';
      }
      else {
        template =
`
  auto _${a.name} = reinterpret_cast<${typename}*>(NanGetInternalFieldPointer(${rhs}->ToObject(), 0));
  auto& ${a.name} = *_${a.name};
`
        rhs = '';
      }
      break;
    case 'enum':
      template =`  auto ${a.name} = static_cast<${typename}>(${rhs}->ToInteger()->Value());`;
      rhs = '';
      break;
    default: {
      rhs += '???' + t + '???';
    }
  }
  var res = template + rhs;
  if (res.indexOf('???') !== -1) {
    console.error(`Accessor generation error: ${f.name}|${a.name}|${res.trim()}`);
    failed_functions[f.name] = true;
    return '';
  }
  return template + rhs;
}

function generateInvocation(f) {
  if (failed_functions[f.name]) {
    return '';
  }

  var template = '  ';
  var t = getType(f.result);
  if (t !== 'void') {
    template += 'auto res = ';
  }
  template += `${f.name}(${f.args.map(function(arg){return arg.name}).join(', ')});`;
  return template;
}

function generateReturn(f) {
  var template = '  ';
  var t = getType(f.result);
  if (t.indexOf('struct') === 0) {
    var typename = t.slice(7);
    t = 'struct';
  }
  else if(t.indexOf('enum') === 0) {
    var typename = t.slice(5);
    t = 'enum';
  }
  else {
    typename = t;
  }

  switch(t) {
    case 'unsigned long long':
    case 'unsigned long':
    case 'long':
    case 'long long':
      template += 'NanReturnValue(NanNew<Number>(res));';
      break;
    case 'unsigned':
    case 'unsigned int':
    case 'unsigned short':
    case 'unsigned char':
      template += 'NanReturnValue(NanNew<Uint32>(res));';
      break;
    case 'int':
    case 'short':
    case 'char':
      template += 'NanReturnValue(NanNew<Int32>(res));';
      break;
    case 'void':
      template += 'NanReturnNull();';
      break;
    case 'unsigned char*':
    case 'signed char*':
    case 'char*':
      template += 'NanReturnValue(NanNew<String>(res));';
      break;
    case 'void*':
    case 'struct':
      if (typename.indexOf('*') !== -1) {
        template =
`
  auto _handle_instance = NanNew(_handle_constructor)->NewInstance();
  NanSetInternalFieldPointer(_handle_instance, 0, (void*)(res));
  NanReturnValue(_handle_instance);
`;
      }
      else {
        template =
`
  auto _res_ptr = new ${typename}(std::move(res));
  auto _handle_instance = NanNew(_handle_constructor)->NewInstance();
  NanSetInternalFieldPointer(_handle_instance, 0, (void*)(_res_ptr));
  NanMakeWeakPersistent(_handle_instance, _res_ptr, &cleanup_ptr);
  NanReturnValue(_handle_instance);
`
      }
      break;
    case 'enum':
      template += `NanReturnValue(NanNew<Integer>(static_cast<int32_t>(res)));`;
      break;
    default: {
      template += '???' + t + '???';
    }
  }

  if (template.indexOf('???') !== -1) {
    console.error(`Result generation error: ${f.name}|${template.trim()}`);
    failed_functions[f.name] = true;
    return '';
  }
  return template;
}

function generateMethod(f) {
  var template = [];
  template.push(`
NAN_METHOD(${f.name}_binding) {`);
  template.push(`  NanScope();`);
  template.push('');
  var generator = _.partial(generateArgAccessor, f);
  template = template.concat(f.args.map(generator));
  template.push(generateInvocation(f));
  template.push(generateReturn(f));
  template.push('}');

  if (failed_functions[f.name]) {
    return `//TODO: fix ${f.name}`;
  }

  return template.join('\n');
}

function generateEnum(e) {
  var template = [];
  template.push(`  auto ${e.name} = NanNew<Object>();`);
  _.each(e.values, function(val, key) {
    template.push(`  ${e.name}->ForceSet(NanNew<String>("${key}"), NanNew<Integer>(${key}), static_cast<PropertyAttribute>(ReadOnly | DontDelete));`);
  });
  template.push(`  exports->Set(NanNew<String>("${e.name}"), ${e.name});`);
  return template.join('\n');
}

function generateExport(f) {
  if (failed_functions[f.name]) {
    return `//TODO: fix ${f.name}`;
  }

  var template = `
  exports->Set(NanNew<String>("${f.name}"),
    NanNew<FunctionTemplate>(${f.name}_binding)->GetFunction());`;
  return template;
}

function generatePrototype(f) {
  if (failed_functions[f.name]) {
    return `//TODO: fix ${f.name}`;
  }

  return `NAN_METHOD(${f.name}_binding);`;
}

function generateBinding(info) {
  var methods = info.functions.map(generateMethod).join('\n');
  var exports = info.functions.map(generateExport).join('\n');
  var enums = info.enums.map(generateEnum).join('\n');
  var src_template = fs.readFileSync(`./${binding}.cc.tmpl`).toString();
  var res = src_template
    .replace('${methods}', methods)
    .replace('${exports}', exports)
    .replace('${enums}', enums);
  sourcefile.write(res);

  var prototypes = info.functions.map(generatePrototype).join('\n');
  var header_template = fs.readFileSync(`./${binding}.h.tmpl`).toString();
  var res = header_template
    .replace('${prototypes}', prototypes);
  headerfile.write(res);
}

generateBinding(info);
