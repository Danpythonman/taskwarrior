Task Warrior Server
===================

Frontend and backend for TaskWarrior and the `task` command.

Deploying Backend
-----------------

1. Make sure Python and Nginx is installed.

2. Clone this repo:

   ```bash
   git clone https://github.com/Danpythonman/mnist_digit_predictor.git ~/.task
   ```

   The location `~/.task` is where the task data will be stored.


3. Install TaskWarrior:

   ```bash
   sudo apt install taskwarrior
   ```

4. Create `.taskrc` file:

   ```bash
   echo 'data.location=~/.task' > ../.taskrc
   ```

5. Follow the instructions in [backend/task-backend.service](./backend/task-backend.service) to install this app as a Systemd service.

6. Follow the instructions in [backend/task-backend.nginx](./backend/task-backend.nginx) to expose this service via Nginx.

7. Get TLS certificate to enable HTTPS:

   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d www.example.com
   ```

Deploying Frontend
------------------

1. Make sure you are in the frontend directory:

   ```bash
   cd frontend
   ```

2. Install Npm dependencies:

   ```bash
   npm install
   ```

3. Build frontend:

   ```bash
   npx vite build --mode production
   ```

   Make sure you have the file .env.production with all the necessary environment variables.

4. At this point there should be a folder called dist with the output files. This is what will be deployed. I like using GCP cloud storage buckets for this kind of thing. Here's how you can upload to a GCP bucket called my-bucket-name (assuming you are still in the frontend directory):

   ```bash
   gsutil -m rsync -R dist/ gs://my-bucket-name
   ```

5. If you want to disable caching on the index.html page in the Google Cloud bucket, use the following commands:

   ```
   gsutil setmeta -h "Cache-Control:no-cache, max-age=0, must-revalidate" gs://my-bucket-name/
   gsutil setmeta -h "Cache-Control:no-cache, max-age=0, must-revalidate" gs://my-bucket-name/index.html
   ```
