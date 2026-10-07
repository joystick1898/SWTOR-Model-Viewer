"""Read-only MYP archive access and STB strings; no downloaded game metadata."""
import struct,zlib
from pathlib import Path
from compression import zstd
MASK=0xffffffff
def rot(x,n):return ((x<<n)|(x>>(32-n)))&MASK
def file_hash(name):
    data=name.lower().encode();a=b=c=(0xdeadbeef+len(data))&MASK;p=0
    while len(data)-p>12:
        x,y,z=struct.unpack_from('<III',data,p);a=(a+x)&MASK;b=(b+y)&MASK;c=(c+z)&MASK
        for n in (4,6,8,16,19,4):
            a=((a-c)&MASK)^rot(c,n);c=(c+b)&MASK;a,b,c=b,c,a
        p+=12
    tail=data[p:]
    if not tail:return (b<<32)|c
    a=(a+int.from_bytes(tail[:4],'little'))&MASK;b=(b+int.from_bytes(tail[4:8],'little'))&MASK;c=(c+int.from_bytes(tail[8:12],'little'))&MASK
    c=((c^b)-rot(b,14))&MASK;a=((a^c)-rot(c,11))&MASK;b=((b^a)-rot(a,25))&MASK
    c=((c^b)-rot(b,16))&MASK;a=((a^c)-rot(c,4))&MASK;b=((b^a)-rot(a,14))&MASK;c=((c^b)-rot(b,24))&MASK
    return (b<<32)|c
class Archives:
    def __init__(self,folder,pattern='*.tor'):
        self.entries={}
        for file in sorted(Path(folder).glob(pattern)):
            if pattern=='*.tor' and not (file.name.startswith('swtor_main_') or file.name=='swtor_en-us_global_1.tor'):continue
            with file.open('rb') as f:
                header=f.read(24)
                if header[:4]!=b'MYP\0':continue
                off=struct.unpack_from('<Q',header,12)[0]
                while off:
                    f.seek(off);count,off=struct.unpack('<IQ',f.read(12));table=f.read(count*34)
                    for start in range(0,len(table),34):
                        position,head,packed,size,key,crc,method=struct.unpack_from('<QIIIQIH',table,start)
                        if position:self.entries[key]=(file,position+head,packed,size,method)
    def read(self,relative):
        key=file_hash('/resources/'+relative.lstrip('/'))
        if key not in self.entries:raise FileNotFoundError(relative)
        file,off,size,expected,method=self.entries[key]
        with file.open('rb') as f:f.seek(off);b=f.read(size)
        if method:b=zstd.decompress(b) if b[:4]==bytes.fromhex('28b52ffd') else zlib.decompress(b)
        if len(b)!=expected:raise ValueError('Archive length mismatch: '+relative)
        return b
def strings(b):
    assert b[:3]==b'\x01\0\0'
    count=struct.unpack_from('<I',b,3)[0];result={}
    assert 7+26*count<=len(b)
    for i in range(count):
        ident,flags,version,size,offset,extra=struct.unpack_from('<QHIIII',b,7+26*i)
        assert offset+size<=len(b)
        text=b[offset:offset+size].decode('utf-8').strip()
        if text and (ident not in result or flags==0):result[ident]=text
    return result
if __name__=='__main__':
    a=Archives('N:/Steam Library/steamapps/common/Star Wars - The Old Republic/Assets');print('Archive files',len(a.entries))
    s=strings(a.read('en-us/str/npc.stb'));print('NPC strings',len(s));print([v for v in s.values() if 'Malgus' in v][:10])
    print(a.read('art/dynamic/skincolor/skincolor_cathar_non_h01_p.xml')[:100])
