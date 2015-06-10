{
  "targets": [
    {
      "target_name": "debugger",
      "sources": [
        "src/mutex-wrap.cc",
        "src/debugger.cc",
        "src/controller.cc",
        "src/worker.cc",
        "src/worker-bindings.cc"
      ],
      "include_dirs": [
        "<!(node -e \"require('nan')\")"
      ],
      "conditions": [
        ["OS==\"win\"", {
          "libraries": ["-lws2_32"]
        }]
      ]
    }
  ]
}
