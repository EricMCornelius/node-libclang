{
  "targets": [
    {
      "target_name": "libclang",
      "sources": [
        "src/libclang_binding.cc"
      ],
      "include_dirs": [
        "<!(node -e \"require('nan')\")",
        "/usr/lib/llvm-3.5/include/",
        "src"
      ],
      "library_dirs": [
        "/usr/lib/llvm-3.5/lib/"
      ],
      "cflags": [
        "-Wall",
        "-O3",
        "-std=c++11"
      ],
      "link_settings": {
        "libraries": [
          "-lclang"
        ]
      }
    }
  ]
}
