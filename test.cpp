int main(int argc, char* argv[]);

typedef void (*Callback)(void*);
unsigned visit(Callback cb, void* data);
