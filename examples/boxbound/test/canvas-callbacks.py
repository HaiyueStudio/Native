"""Exercise patched Android callback ownership with real POSIX pipes and a fake looper/V8."""
import importlib.util,pathlib,subprocess,tempfile
app=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('patch',app/'scripts/rebuild-canvas-android.py');patch=importlib.util.module_from_spec(spec);spec.loader.exec_module(patch)
with tempfile.TemporaryDirectory(prefix='boxbound-callback-test-') as tmp:
 root=pathlib.Path(tmp);(root/'android').mkdir()
 (root/'Common.h').write_text('''#pragma once
#include <memory>
#include <mutex>
namespace v8 { class Isolate {}; class Function {}; class Promise {public: class Resolver {};};
template<class T> struct Local {};
template<class T> struct Persistent { Persistent(Isolate*, Local<T>){} void Reset(){} }; }
''')
 (root/'Caches.h').write_text('#pragma once\n')
 (root/'android/looper.h').write_text('''#pragma once
struct ALooper {int fd=-1; int refs=0; int (*callback)(int,int,void*)=nullptr; void* data=nullptr;};
inline ALooper loop;
#define ALOOPER_EVENT_INPUT 1
inline ALooper* ALooper_prepare(int){return &loop;}
inline void ALooper_acquire(ALooper* l){++l->refs;}
inline void ALooper_release(ALooper* l){--l->refs;}
inline int ALooper_removeFd(ALooper* l,int fd){if(l->fd==fd)l->fd=-1;return 1;}
inline int ALooper_addFd(ALooper* l,int fd,int,int,int(*cb)(int,int,void*),void* data){l->fd=fd;l->callback=cb;l->data=data;return 1;}
''')
 (root/'test.cpp').write_text('''#include "PromiseCallback.h"
#include "AsyncCallback.h"
#include <cerrno>
#include <cstdio>
template<class C,class V> bool check(){
 for(int i=0;i<2000;i++){
  bool finished=false;
  auto cb=new C(nullptr,v8::Local<V>{},[](bool ok,void* ptr){auto c=static_cast<C*>(ptr);*static_cast<bool*>(c->inner_->data)=ok;delete c;});
  std::weak_ptr<typename C::Inner> weak=cb->inner_;cb->inner_->data=&finished;cb->prepare();
  int r=cb->inner_->fd_[0],w=cb->inner_->fd_[1];cb->execute(true);
  loop.callback(r,ALOOPER_EVENT_INPUT,loop.data);
  if(!finished||!weak.expired()||loop.refs!=0||fcntl(r,F_GETFD)!=-1||fcntl(w,F_GETFD)!=-1)return false;
 }
 return true;
}
int main(){return check<PromiseCallback,v8::Promise::Resolver>()&&check<AsyncCallback,v8::Function>()?0:1;}
''')
 for fixed in [False,True]:
  for name in ['PromiseCallback','AsyncCallback']:
   text=(patch.CANVAS/'platforms/ios/src/cpp'/(name+'.h')).read_text()
   (root/(name+'.h')).write_text((patch.patch_callback(text,name) if fixed else text).replace('#ifdef __APPLE__','#if 0 // Test Android branch on host'))
  subprocess.run(['clang++','-std=c++17','-D__ANDROID__','-I'+str(root),str(root/'test.cpp'),'-o',str(root/'check')],check=True)
  result=subprocess.run([str(root/'check')])
  assert result.returncode==(0 if fixed else 1),f'Unexpected lifetime result fixed={fixed}'
print('Original reproduces leak; patched 4,000 callbacks release both pipe ends, looper references and callback owners.')
