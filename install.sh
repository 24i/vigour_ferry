#!/usr/bin/env bash

# Usage: install.sh branch-name

# Update system
sudo yum -y update

# Install git
sudo yum -y install git

# Setup SSH keys
mv id_rsa id_rsa.pub ~/.ssh/
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_rsa

# Install node and npm
sudo yum -y install nodejs npm --enablerepo=epel

# Set npm version
sudo npm install npm@2.10.1 -g

# Install global dependencies
sudo npm install forever -g

# Clone repos
git clone git@github.com:vigour-io/vigour-packer-server.git
git clone git@github.com:shawninder/portProxy.git

# Get certificates
mv certificate.pem private_key.pem ~/portProxy/cert/

# Launch proxies
cd portProxy
npm install
nohup npm start -- 80 8000 &
nohup npm start -- 443 8000 $1 &
cd ..

# Launch packer server
mv .package.json vigour-packer-server
cd vigour-packer-server
npm install
cd server
npm install
nohup npm start &
cd ..