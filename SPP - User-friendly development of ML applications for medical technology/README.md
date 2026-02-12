# VM Pipeline GUI - SPP WS25/26

## User-friendly development of ML applications for medical technology

This repository contains the source code for the graphical user interface (GUI) and backend developed by **SPP WS25/26 Team VM**. The primary goal is to facilitate the creation and execution of Machine Learning workflows for medical technology applications.

The application allows users with little to no workflow experience to build "Virtual Measurement" pipelines using a **Drag-and-Drop** visual editor. It automates the configuration of Argo Workflows, managing parameters and S3 data connections.

---

### Core Components

The project is structured into three logical layers within a single repository to ensure tight integration:

1. **Frontend (`/frontend`):**
   The React application using **React Flow** for the visual graph editor. It is built as a static asset during the Docker build process.

2. **Backend (`/vm_gui` & `/api`):**
   The Django server acts as the main entry point. It serves the compiled Frontend and provides the REST API to communicate with the Kubernetes Cluster (Argo Workflows) and AWS S3.

3. **Infrastructure (`/k8s`):**
   Contains the Kubernetes manifests (Deployment, Service) and the Multi-Stage `Dockerfile` required to deploy the application to the RWTH Cluster.

---

## Key Features

Based on our development roadmap, the following features are implemented:

* **Visual Workflow Editor:** Node-based interface to drag and drop ML blocks (React Flow).
* **Argo Workflows Integration:** Dynamically fetches templates directly from the cluster via REST API.
* **Smart Template Filtering:** Search and filter functionality to quickly find relevant Argo templates.
* **Dynamic Configuration:**
    * **Entrypoint Selection:** Manually select specific function entrypoints within tasks.
    * **Parameter Panel:** Automatically generates input forms based on the selected template schema.
* **S3 Data Management:** User interface for configuring S3 credentials (Endpoint, Keys) directly in the app.
* **Execution & Export:**
    * **Direct Submission:** Submit workflows to the Kubernetes cluster via API.
    * **YAML Export:** Download the generated pipeline definition for manual review.

For a deeper technical understanding, a detailed code documentation is generated using **Sphinx**.

---

## Tech Stack

### Frontend
* **React:** Main UI framework.
* **React Flow:** Library for visualizing and editing the node-based graph.
* **Styles:** CSS-in-JS (Component-scoped styles).

### Backend
* **Django REST Framework:** API for communication between frontend and cluster.
* **Hera Workflows SDK:** Python library to programmatically convert the abstract graph into valid Argo Workflow YAML definitions.
* **Argo Workflows API:** Direct interaction with the cluster.

### Infrastructure
* **Docker:** Multi-stage build for optimized production images.
* **Kubernetes:** Deployment targets for the RWTH Compute Cluster.
* **AWS S3:** Object storage for workflow artifacts.

---

## Installation & Local Development

**Prerequisites:**
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### 1. Clone the Repository
```bash
git clone https://git-ce.rwth-aachen.de/wzl-mq-ms-rpc/code/research/predictive-quality/vm-pipeline-gui
cd vm-pipeline-gui
```

### 2. Environment Configuration
Create a `.env` file in the root directory (use `.env.example` as a template):

```ini
# Django Settings
DEBUG=True
SECRET_KEY=your_secret_key_here

# AWS Credentials (optional, can be set in GUI)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=...
AWS_S3_REGION_NAME=eu-central-1
```

### 3. Start the Application
Run the following command to build and start the container:

```bash
docker compose up --build
```
The application will be accessible at http://localhost:8000.

### Deployment (Kubernetes)
The project includes ready-to-use Kubernetes manifests found in the `/k8s` directory. The production image is hosted on Docker Hub: `youruser/spp-monolith:latest`

To deploy updates to the cluster:

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

---

## Team & Contributions

**Lab for Machine Tools and Production Engineering (WZL)**
Chair of Intelligence in Quality Sensing.

**Supervisors:**
* Lukas Krebs
* Marvin Kresimon

**Core Development Team (SPP WS25/26):**

* **Mauricio Wilneder** (`mauricio.wilneder@rwth-aachen.de`)
    * **Frontend:** UI Layout, Drag-and-Drop Implementation, Parameter Panel Design, S3 Config UI.
    * **DevOps:** Dockerfile Creation (Multi-Stage), UX Improvements.
    * **Testing:** Validation of Test Runs.

* **Pau Azpeitia** (`pau.azpeitia.bergos@rwth-aachen.de`)
    * **Backend:** Django API Setup, Argo REST API Integration, YAML Download & Submission Endpoints, Frontend–Backend communication management.
    * **Frontend Logic:** Sidebar, Parameter Panel Logic (Entrypoints, Parameters, Interfaces), Buttons.
    * **Workflow Engine:** Hera Integration, S3 Secret Implementation, Path Management.
    * **DevOps:** Dockerfile Creation (Multi-Stage), UX Improvements.
    * **Data:** Dataset Structure & Analysis, Argo methods analysis.
    * **Testing:** Validation of Test Runs.

* **Jean Alsino** (`jean.alsino@rwth-aachen.de`)
    * **Infrastructure:** Kubernetes Manifests.
    * **Documentation:** Sphinx Documentation.
    * **Frontend:** Filter Functions in Sidebar.
    * **Data:** Argo methods analysis.

* **Monique Zentgraf** (`monique.zentgraf@rwth-aachen.de`)
    * **Documentation:** Sphinx Documentation.

### Repository Access
* **Repository URL:** [https://git-ce.rwth-aachen.de/wzl-mq-ms-rpc/code/research/predictive-quality/vm-pipeline-gui](https://git-ce.rwth-aachen.de/wzl-mq-ms-rpc/code/research/predictive-quality/vm-pipeline-gui)

> **Notes:**
> * Access requires connection via RWTH VPN or Eduroam.
> * The `token_secret.yaml` file is private and is therefore not included in this repository.