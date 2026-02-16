# 🚀 AWS Deployment Guide

This guide walks you through deploying the E-Commerce Analytics Platform on AWS using EC2, RDS, and S3.

## 📋 Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed and configured
- SSH key pair for EC2 access
- Domain name (optional, for custom domain)

## 🏗️ Architecture Overview

```
Internet
    ↓
EC2 Instance (Docker Host)
├── Nginx (Reverse Proxy)
├── API Gateway
├── Microservices (5 containers)
├── Frontend
├── MongoDB (Container)
└── Redis (Container)
    ↓
AWS RDS
├── MySQL (User Service)
└── PostgreSQL (Order Service)
    ↓
AWS S3 (Product Images)
```

## 📦 Step-by-Step Deployment

### Step 1: Create RDS Instances

#### Create MySQL Instance (User Service)

```bash
aws rds create-db-instance \
    --db-instance-identifier ecommerce-mysql \
    --db-instance-class db.t3.micro \
    --engine mysql \
    --engine-version 8.0 \
    --master-username admin \
    --master-user-password YOUR_SECURE_PASSWORD \
    --allocated-storage 20 \
    --backup-retention-period 7 \
    --publicly-accessible false \
    --vpc-security-group-ids sg-XXXXXXXX \
    --db-name users_db
```

#### Create PostgreSQL Instance (Order Service)

```bash
aws rds create-db-instance \
    --db-instance-identifier ecommerce-postgres \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15 \
    --master-username postgres \
    --master-user-password YOUR_SECURE_PASSWORD \
    --allocated-storage 20 \
    --backup-retention-period 7 \
    --publicly-accessible false \
    --vpc-security-group-ids sg-XXXXXXXX \
    --db-name orders_db
```

**Note**: Save the endpoints after creation:
```bash
# Get MySQL endpoint
aws rds describe-db-instances \
    --db-instance-identifier ecommerce-mysql \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text

# Get PostgreSQL endpoint
aws rds describe-db-instances \
    --db-instance-identifier ecommerce-postgres \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text
```

### Step 2: Create S3 Bucket

```bash
# Create bucket
aws s3 mb s3://ecommerce-platform-images-$(date +%s)

# Enable versioning
aws s3api put-bucket-versioning \
    --bucket ecommerce-platform-images-XXXXX \
    --versioning-configuration Status=Enabled

# Set CORS configuration
cat > cors.json << EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

aws s3api put-bucket-cors \
    --bucket ecommerce-platform-images-XXXXX \
    --cors-configuration file://cors.json
```

### Step 3: Create Security Groups

#### EC2 Security Group

```bash
# Create security group
aws ec2 create-security-group \
    --group-name ecommerce-ec2-sg \
    --description "Security group for E-Commerce EC2 instance" \
    --vpc-id vpc-XXXXXXXX

# Allow SSH
aws ec2 authorize-security-group-ingress \
    --group-id sg-XXXXXXXX \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0

# Allow HTTP
aws ec2 authorize-security-group-ingress \
    --group-id sg-XXXXXXXX \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0

# Allow HTTPS
aws ec2 authorize-security-group-ingress \
    --group-id sg-XXXXXXXX \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0
```

#### RDS Security Group

```bash
# Create security group
aws ec2 create-security-group \
    --group-name ecommerce-rds-sg \
    --description "Security group for E-Commerce RDS instances" \
    --vpc-id vpc-XXXXXXXX

# Allow MySQL from EC2
aws ec2 authorize-security-group-ingress \
    --group-id sg-YYYYYYYY \
    --protocol tcp \
    --port 3306 \
    --source-group sg-XXXXXXXX

# Allow PostgreSQL from EC2
aws ec2 authorize-security-group-ingress \
    --group-id sg-YYYYYYYY \
    --protocol tcp \
    --port 5432 \
    --source-group sg-XXXXXXXX
```

### Step 4: Launch EC2 Instance

```bash
aws ec2 run-instances \
    --image-id ami-0c55b159cbfafe1f0 \
    --instance-type t3.medium \
    --key-name your-key-pair \
    --security-group-ids sg-XXXXXXXX \
    --subnet-id subnet-XXXXXXXX \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=ecommerce-app}]' \
    --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=30,VolumeType=gp3}' \
    --user-data file://infrastructure/ec2/user-data.sh
```

**Recommended Instance Types:**
- **Development**: t3.medium (2 vCPU, 4GB RAM) - ~$30/month
- **Production**: t3.large (2 vCPU, 8GB RAM) - ~$60/month
- **High Traffic**: t3.xlarge (4 vCPU, 16GB RAM) - ~$120/month

### Step 5: Connect to EC2 and Setup

```bash
# Get EC2 public IP
aws ec2 describe-instances \
    --instance-ids i-XXXXXXXXX \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text

# SSH into EC2
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# Download and run setup script
curl -o setup.sh https://raw.githubusercontent.com/your-repo/main/infrastructure/ec2/setup-script.sh
chmod +x setup.sh
sudo ./setup.sh
```

### Step 6: Configure Environment Variables

On your EC2 instance, update the environment files:

```bash
cd /home/ubuntu/ecommerce-analytics-platform

# Update User Service
nano services/user-service/.env
# Set:
# DB_HOST=<RDS_MYSQL_ENDPOINT>
# DB_PASSWORD=<YOUR_MYSQL_PASSWORD>
# JWT_SECRET=<GENERATE_RANDOM_SECRET>

# Update Product Service
nano services/product-service/.env
# Set:
# AWS_ACCESS_KEY_ID=<YOUR_AWS_KEY>
# AWS_SECRET_ACCESS_KEY=<YOUR_AWS_SECRET>
# S3_BUCKET_NAME=<YOUR_S3_BUCKET>

# Update Order Service
nano services/order-service/.env
# Set:
# DB_HOST=<RDS_POSTGRES_ENDPOINT>
# DB_PASSWORD=<YOUR_POSTGRES_PASSWORD>
```

### Step 7: Build and Push Docker Images

On your local machine:

```bash
# Login to Docker Hub
docker login

# Build and push all images
services=("user-service" "product-service" "order-service" "analytics-service" "api-gateway")

for service in "${services[@]}"; do
    echo "Building $service..."
    docker build -t yourusername/$service:latest ./services/$service
    docker push yourusername/$service:latest
done

# Build and push frontend
docker build -t yourusername/frontend:latest ./frontend
docker push yourusername/frontend:latest
```

### Step 8: Deploy on EC2

On your EC2 instance:

```bash
cd /home/ubuntu/ecommerce-analytics-platform

# Set Docker username
export DOCKER_USERNAME=yourusername

# Pull images
docker-compose -f docker-compose.prod.yml pull

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 9: Verify Deployment

```bash
# Test health endpoints
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
curl http://localhost:8004/health

# Test via Nginx
curl http://<EC2_PUBLIC_IP>/api/health
```

### Step 10: Setup GitHub Actions (Optional)

Add these secrets to your GitHub repository:

- `DOCKER_USERNAME`: Your Docker Hub username
- `DOCKER_PASSWORD`: Your Docker Hub password
- `EC2_HOST`: Your EC2 public IP or domain
- `EC2_SSH_KEY`: Your private SSH key for EC2

Now every push to `main` will trigger automatic deployment!

## 🔒 Security Best Practices

1. **Use AWS Secrets Manager** for sensitive credentials
2. **Enable AWS Systems Manager Session Manager** instead of SSH
3. **Setup CloudWatch alarms** for monitoring
4. **Enable RDS encryption** at rest
5. **Use AWS Certificate Manager** for HTTPS
6. **Implement AWS WAF** for API protection
7. **Enable VPC Flow Logs** for network monitoring
8. **Regular security updates**: `sudo apt update && sudo apt upgrade`

## 📊 Monitoring

### CloudWatch Setup

```bash
# Install CloudWatch agent on EC2
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Configure CloudWatch
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

### View Logs

```bash
# Application logs
docker-compose -f docker-compose.prod.yml logs -f [service-name]

# System logs
sudo journalctl -u docker -f

# Nginx access logs
docker-compose exec nginx tail -f /var/log/nginx/access.log
```

## 💰 Cost Estimation (Monthly)

| Resource | Configuration | Cost |
|----------|--------------|------|
| EC2 t3.medium | 2 vCPU, 4GB RAM | $30 |
| RDS MySQL (t3.micro) | 1 vCPU, 1GB RAM | $15 |
| RDS PostgreSQL (t3.micro) | 1 vCPU, 1GB RAM | $15 |
| S3 Storage | 10GB + requests | $1-5 |
| Data Transfer | 100GB/month | $9 |
| **Total** | | **~$70/month** |

## 🔄 Updates and Rollbacks

### Update Application

```bash
# On EC2
cd /home/ubuntu/ecommerce-analytics-platform
git pull origin main
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### Rollback

```bash
# Stop current version
docker-compose -f docker-compose.prod.yml down

# Pull previous version
docker pull yourusername/service-name:previous-tag

# Update docker-compose with previous tag
# Start services
docker-compose -f docker-compose.prod.yml up -d
```

## 🆘 Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs [service-name]

# Check container status
docker ps -a

# Restart service
docker-compose -f docker-compose.prod.yml restart [service-name]
```

### Can't connect to RDS

```bash
# Test connection from EC2
mysql -h <RDS_ENDPOINT> -u admin -p
psql -h <RDS_ENDPOINT> -U postgres -d orders_db

# Check security group rules
aws ec2 describe-security-groups --group-ids sg-XXXXXXXX
```

### High Memory Usage

```bash
# Check memory
free -h

# Check container stats
docker stats

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

## 📞 Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Review CloudWatch metrics
3. Open an issue on GitHub
4. Check AWS Service Health Dashboard

---

**Deployment Complete! 🎉**

Your E-Commerce Analytics Platform is now live on AWS!

Access your application at: `http://<EC2_PUBLIC_IP>`
