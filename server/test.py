import socket
import sys
s = socket.socket()
s.bind(("localhost",9999))
s.listen(10) # Acepta hasta 10 conexiones entrantes.



while True:
    sc, address = s.accept()
    print address
    i=1
    f = open('assets/dickmessage.mp3','wb') #open in binary
    i=i+1
    while (True):       
    # recibimos y escribimos en el fichero
        l = sc.recv(1024)
        while (l):
                f.write(l)
                l = sc.recv(1024)
    f.close()


    sc.close()

s.close()