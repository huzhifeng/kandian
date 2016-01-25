#!/usr/bin/env bash

YUM_INSTALL="yum -y install"
YUM_REMOVE="yum -y remove"
YUM_GROUPINSTALL="yum -y groupinstall"
APT_INSTALL="apt-get -y install"
APT_REMOVE="apt-get -y remove"
WORK_DIR="/work"
INSTALL_DIR="/usr/local/bin"
KANDIAN_DIR=kandian
DB_PATH=/work/db
DB_LOG=/dev/null
DB_PORT=27017
if [ "$dbPort" != "" ]; then DB_PORT=$dbPort; fi
DB_AUTH=0
if [ "$dbAuth" != "" ]; then DB_AUTH=$dbAuth; fi
DISTRO=
ARCH=
SUCCESS=0
FAIL=1

get_distro() {
    echo "Detecting system..."
    if grep -Eqi "CentOS" /etc/issue || grep -Eq "CentOS" /etc/*-release; then
        DISTRO="CentOS"
    elif grep -Eqi "Ubuntu" /etc/issue || grep -Eq "Ubuntu" /etc/*-release; then
        DISTRO="Ubuntu"
    else
        echo "Only CentOS and Ubuntu are supported"
        cat /etc/os-release || cat /etc/issue
        exit $FAIL
    fi

    echo "Your OS is $DISTRO"
    return $SUCCESS;
}

get_arch() {
    # ARCH=`uname -m`
    # if [ "$ARCH" != "x86_64" ]; then echo "$ARCH is not a 64bit OS"; exit $FAIL; fi
    if [[ `getconf WORD_BIT` = '32' && `getconf LONG_BIT` = '64' ]] ; then
        ARCH=64
    else
        ARCH=32
    fi

    echo "Your OS is ${ARCH}-bit"
    return $SUCCESS;
}

install_dev() {
    echo "Installing basic development tools..."
    if [ "$DISTRO" == "CentOS" ]; then
        $YUM_GROUPINSTALL "Development Tools"
        $YUM_INSTALL make gcc gcc-c++ gcc-g77 flex bison autoconf automake libtool bzip2-devel zlib-devel ncurses-devel libjpeg-devel libpng-devel libtiff-devel freetype-devel pam-devel openssl-devel libxml2-devel gettext-devel pcre pcre-devel wget
    else
        $APT_INSTALL build-essential libpcre3 libpcre3-dev libcurl4-openssl-dev curl wget
    fi

    if [ $? -ne 0 ]; then
        echo "Failed to install development tools"
        return $FAIL
    else
        echo "Install development tools successful"
        return $SUCCESS
    fi
}

# http://git-scm.com/book/en/Getting-Started-Installing-Git#Installing-from-Source
# yum -y install curl-devel expat-devel gettext-devel openssl-devel zlib-devel perl-devel
# wget https://www.kernel.org/pub/software/scm/git/git-2.1.2.tar.xz
# tar -xf git-2.1.2.tar.xz
# cd git-2.1.2
# ./configure prefix=/usr
# make && make install

install_git() {
    ver=`git --version`
    if [ "${ver}" == "git version 2.4.6" ]; then echo "git-2.4.6 exist, skip installing"; return $SUCCESS; fi

    echo "Installing git..."
    if [ "$DISTRO" == "CentOS" ]; then
        $YUM_INSTALL curl-devel expat-devel gettext-devel openssl-devel zlib-devel perl-devel asciidoc xmlto docbook2x
        $YUM_REMOVE git
    else
        $APT_INSTALL libcurl4-gnutls-dev libexpat1-dev gettext libz-dev libssl-dev asciidoc xmlto docbook2x
        $APT_REMOVE git
    fi

    git_xz_url=https://www.kernel.org/pub/software/scm/git/git-2.4.6.tar.xz
    sha256sums_url=https://www.kernel.org/pub/software/scm/git/sha256sums.asc
    sha256sums_name=sha256sums.asc
    git_xz_name=git-2.4.6.tar.xz
    git_src_dir=git-2.4.6
    cd $WORK_DIR
    wget "$sha256sums_url" -O "$sha256sums_name"
    if [ -f $git_xz_name ] && grep `sha256sum $git_xz_name` $sha256sums_name; then
        echo "$git_xz_name exist, skip downloading"
    else
        wget "${git_xz_url}" -O "${git_xz_name}"
        if grep `sha256sum $git_xz_name` $sha256sums_name; then echo ""; else echo "Failed to download $git_xz_name"; return $FAIL; fi
    fi
    rm -rf $git_src_dir && tar -xf $git_xz_name && cd $git_src_dir
    if [ $? -ne 0 ]; then echo "Failed to uncompress $git_xz_name"; return $FAIL; fi
    ./configure prefix=/usr && make && make install
    if [ $? -ne 0 ]; then echo "Failed to install git"; return $FAIL; fi

    echo "Install git successful"
    return $SUCCESS
}

# http://wiki.nginx.org/Install
# wget http://nginx.org/download/nginx-1.6.0.tar.gz -O nginx-1.6.0.tar.gz
# tar -xzf nginx-1.6.0.tar.gz && cd nginx-1.6.0
# ./configure                   Please refer to <http://nginx.org/en/docs/configure.html> for detail
# make && make install

install_nginx() {
    which nginx
    if [ $? -eq 0 ]; then echo "nginx exist, skip installing"; return $SUCCESS; fi
    if [ "$DISTRO" == "CentOS" ]; then
        $YUM_INSTALL gnupg
        $YUM_REMOVE httpd apache2
    else
        $APT_INSTALL gnupg
        $APT_REMOVE httpd apache2
    fi

    echo "Installing nginx..."
    nginx_tar_url=http://nginx.org/download/nginx-1.8.0.tar.gz
    nginx_tar_asc_url=http://nginx.org/download/nginx-1.8.0.tar.gz.asc
    nginx_tar_name=nginx-1.8.0.tar.gz
    nginx_tar_asc_name=nginx-1.8.0.tar.gz.asc
    nginx_src_dir=nginx-1.8.0
    keyserver=hkp://pgp.mit.edu
    # keyserver=subkeys.pgp.net
    cd $WORK_DIR
    wget "$nginx_tar_asc_url" -O "$nginx_tar_asc_name" && gpg --verify $nginx_tar_asc_name
    if [ $? -ne 0 ]; then
        rsa_key_id=`gpg --verify $nginx_tar_asc_name 2>&1 | grep "RSA key ID" | rev | cut -d ' ' -f1 | rev`
        echo "Importing RSA key ID $rsa_key_id"
        gpg --keyserver $keyserver --recv-keys $rsa_key_id
    fi
    if [ -f $nginx_tar_name ] && gpg --verify $nginx_tar_asc_name $nginx_tar_name; then
        echo "$nginx_tar_name exist, skip downloading"
    else
        wget "${nginx_tar_url}" -O "${nginx_tar_name}"
        if gpg --verify $nginx_tar_asc_name $nginx_tar_name; then echo ""; else echo "Failed to download $nginx_tar_name"; return $FAIL; fi
    fi
    rm -rf $nginx_src_dir && tar -xzf $nginx_tar_name && cd $nginx_src_dir
    if [ $? -ne 0 ]; then echo "Failed to uncompress $nginx_tar_name"; return $FAIL; fi
    ./configure --prefix=/usr/local/nginx --sbin-path=$INSTALL_DIR && make && make install && which nginx
    if [ $? -ne 0 ]; then echo "Failed to install nginx"; return $FAIL; fi

    echo "Install nginx successful"
    return $SUCCESS
}

# http://docs.mongodb.org/manual/tutorial/install-mongodb-on-linux/
# curl -O http://downloads.mongodb.org/linux/mongodb-linux-x86_64-2.6.4.tgz
# tar -zxvf mongodb-linux-x86_64-2.6.4.tgz
# mkdir -p mongodb
# cp -R -n mongodb-linux-x86_64-2.6.4/ mongodb
# Add `export PATH=<mongodb-install-directory>/bin:$PATH` to ~/.bashrc

install_mongod() {
    which mongod
    if [ $? -eq 0 ]; then echo "mongod exist, skip installing"; return $SUCCESS; fi

    echo "Installing mongod..."
    if [ $ARCH -eq 64 ]; then architecture="x86_64"; else architecture="i686"; fi
    mongodb_tar_url=http://fastdl.mongodb.org/linux/mongodb-linux-${architecture}-2.4.5.tgz
    mongodb_tar_md5_url=http://downloads.mongodb.org/linux/mongodb-linux-${architecture}-2.4.5.tgz.md5
    mongodb_tar_name=mongodb-linux-${architecture}-2.4.5.tgz
    mongodb_tar_md5_name=mongodb-linux-${architecture}-2.4.5.tgz.md5
    mongodb_src_dir=mongodb-linux-${architecture}-2.4.5
    cd $WORK_DIR
    wget "$mongodb_tar_md5_url" -O "$mongodb_tar_md5_name"
    if [ -f $mongodb_tar_name ] && grep `md5sum $mongodb_tar_name | cut -d ' ' -f 1` $mongodb_tar_md5_name; then
        echo "$mongodb_tar_name exist, skip downloading"
    else
        wget "$mongodb_tar_url" -O "$mongodb_tar_name"
        if [ $? -ne 0 ]; then echo "Failed to download $mongodb_tar_name"; rm -f $mongodb_tar_name; return $FAIL; fi
    fi
    mkdir -p $mongodb_src_dir && tar -xzf $mongodb_tar_name -C $mongodb_src_dir
    if [ $? -ne 0 ]; then echo "Failed to uncompress $mongodb_tar_name"; return $FAIL; fi
    find $mongodb_src_dir -type f -perm /+x -exec cp "{}" $INSTALL_DIR \;
    #find $mongodb_src_dir -type f -perm /+x | xargs -I "{}" cp "{}" $INSTALL_DIR
    if [ $? -ne 0 ]; then echo "Failed to install mongod"; return $FAIL; fi

    echo "Install mongod successful"
    return $SUCCESS
}

stop_mongod() {
    ps -ef | grep "mongod" | grep -v "grep"
    if [ $? -eq 0 ]; then killall mongod; echo "Stop mongod successful"; else echo "Failed to stop mongod, it's not running"; fi
}

start_mongod() {
    echo "Launching mongod..."
    [ ! -d $DB_PATH ] && mkdir -p $DB_PATH
    if [ $ARCH -eq 64 ]; then
        mongod --dbpath=$DB_PATH --port=$DB_PORT --logpath=$DB_LOG --fork
    else
        mongod --dbpath=$DB_PATH --port=$DB_PORT --logpath=$DB_LOG --journal --fork
    fi
    if [ $? -ne 0 ]; then echo "Failed to launch mongod"; return $FAIL; fi

    echo "Launch mongod successful"
    return $SUCCESS;
}

restart_mongod() {
    echo "Restarting mongod..."
    stop_mongod
    if [ $? -ne 0 ]; then echo "Failed to stop mongod"; return $FAIL; fi
    start_mongod
    if [ $? -ne 0 ]; then echo "Failed to restart mongod"; return $FAIL; fi

    echo "Restart mongod successful"
    return $SUCCESS
}

# https://github.com/joyent/node/wiki/Installation#building-prerequisites
# GCC 4.2 or newer
# GNU make 3.81 or newer. Pre-installed on most systems. Sometimes called gmake.
# python 2.6 or 2.7. The build tools distributed with Node run on python.
# libssl-dev (Node v0.6.x only.) Can usually be installed on *NIX systems with your favorite package manager. Pre-installed on OS X.
# libexecinfo (FreeBSD and OpenBSD only.) Required by V8. pkg_add -r libexecinfo installs it.
# ICU (optional) to build the Intl (EcmaScript 402) support.

# https://github.com/joyent/node/wiki/Installation#building-on-linux
# tar -zxf node-v0.6.18.tar.gz #Download this from nodejs.org
# cd node-v0.6.18
# ./configure && make && sudo make install
# node and npm will been installed in /usr/local/bin by default, I often want to install it to /usr/bin, so I use "./configure --prefix=/usr" instead

install_node() {
    which node && which npm
    if [ $? -eq 0 ]; then echo "node/npm exist, skip installing"; return $SUCCESS; fi

    echo "Installing node/npm..."
    node_tar_url=http://nodejs.org/dist/v0.10.15/node-v0.10.15.tar.gz
    sha256sums_url=http://nodejs.org/dist/v0.10.15/SHASUMS256.txt
    node_tar_name=node-v0.10.15.tar.gz
    sha256sums_name=SHASUMS256.txt
    node_src_dir=node-v0.10.15
    cd $WORK_DIR
    wget "$sha256sums_url" -O "$sha256sums_name"
    if [ -f $node_tar_name ] && grep `sha256sum $node_tar_name` $sha256sums_name; then
        echo "$node_tar_name exist, skip downloading"
    else
        wget "${node_tar_url}" -O "${node_tar_name}"
        if grep `sha256sum $node_tar_name` $sha256sums_name; then echo ""; else echo "Failed to download $node_tar_name"; return $FAIL; fi
    fi

    tar -xzf $node_tar_name && cd $node_src_dir
    if [ $? -ne 0 ]; then echo "Failed to uncompress $node_tar_name"; return $FAIL; fi
    ./configure && make && make install && which node
    if [ $? -ne 0 ]; then echo "Failed to install node/npm"; return $FAIL; fi

    echo "Install node/npm successful"
    return $SUCCESS
}

install_forever() {
    which forever && return $SUCCESS
    echo "Installing forever..."
    npm update npm -g
    if [ $? -ne 0 ]; then echo "Failed to update npm"; return $FAIL; fi
    npm -g install forever
    if [ $? -ne 0 ]; then echo "Failed to install forever"; return $FAIL; fi

    echo "Install forever successful"
    return $SUCCESS
}

install_kandian() {
    kandian_git=https://github.com/huzhifeng/kandian.git
    cd $WORK_DIR
    if [ -d $KANDIAN_DIR ]; then echo "kandian exist, skip cloning"; else echo "Cloning kandian..."; git clone "$kandian_git"; fi
    cd $KANDIAN_DIR && npm install
    if [ $? -ne 0 ]; then echo "Failed to install kandian"; return $FAIL; fi

    echo "Install kandian successful"
    return $SUCCESS
}

start_kandian() {
    install_forever
    forever list | grep "server.js"
    if [ $? -eq 0 ]; then echo "kandian is running, skip launching"; return $SUCCESS; fi
    echo "Launching kandian..."
    cd $WORK_DIR && cd $KANDIAN_DIR
    if [ "$DB_AUTH" == "0" ]; then sed -i "s/dbAuth || 1/dbAuth || 0/g" config.js; fi
    forever start server.js
    if [ $? -ne 0 ]; then echo "Failed to launch kandian"; return $FAIL; fi

    echo "Launch kandian successful"
    return $SUCCESS
}

stop_kandian() {
    forever list | grep "server.js"
    if [ $? -ne 0 ]; then echo "kandian is not running, skip stopping"; return $SUCCESS; fi
    echo "Stopping kandian..."
    cd $WORK_DIR && cd $KANDIAN_DIR && forever stop server.js
    if [ $? -ne 0 ]; then echo "Failed to stop kandian"; return $FAIL; fi

    echo "Stop kandian successful"
    return $SUCCESS
}

restart_kandian() {
    echo "Restarting kandian..."
    stop_kandian
    if [ $? -ne 0 ]; then echo "Failed to stop kandian"; return $FAIL; fi
    start_kandian
    if [ $? -ne 0 ]; then echo "Failed to restart kandian"; return $FAIL; fi

    echo "Restart kandian successful"
    return $SUCCESS
}

if [ $# == 0 ]; then action="all"; else action=$1; fi
get_distro
get_arch
[ ! -d $WORK_DIR ] && mkdir -p $WORK_DIR
export PATH=$PATH:$INSTALL_DIR
case "$action" in
    all)
        for cmd in install_dev install_git install_nginx install_mongod install_node install_forever install_kandian restart_mongod restart_kandian; do
            $cmd
            if [ $? -ne 0 ]; then exit $FAIL; fi
        done
        ;;
    *)
        $action
        if [ $? -ne 0 ]; then exit $FAIL; fi
esac

exit $SUCCESS
