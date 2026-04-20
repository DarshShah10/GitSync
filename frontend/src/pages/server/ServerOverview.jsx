import { Cpu, HardDrive, Network, Database, Layers, MemoryStick, Activity } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { serversApi } from '../../services/servers.js'
import styles from './ServerOverview.module.css'

export default function ServerOverview() {
  const { id } = useParams()
  
  const { data: servers = [] } = useQuery({
    queryKey: ['servers', 'list'],
    queryFn: serversApi.list,
  })

  const server = servers.find(s => s.id === id) || { 
    id, name: '...', ip: '...', port: '...', status: '...', authType: '...' 
  }

  // Dummy metrics
  const metrics = {
    cpu: 32,
    mem: 61,
    disk: 45,
    net: 15,
  }

  return (
    <div className={styles.overview}>
      
      {/* Top Metrics Row */}
      <div className={styles.metricsRow}>
        <div className={styles.metricCard}>
          <div className={styles.metricTop}>
            <span className={styles.metricTitle}>CPU Load</span>
            <Cpu className={styles.metricIcon} size={16} />
          </div>
          <div className={styles.metricValue}>{metrics.cpu}%</div>
          <div className={styles.barTrack}>
            <div className={`${styles.barFill} ${styles.fillCpu}`} style={{width: `${metrics.cpu}%`}}></div>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricTop}>
            <span className={styles.metricTitle}>Memory</span>
            <MemoryStick className={styles.metricIcon} size={16} />
          </div>
          <div className={styles.metricValue}>{metrics.mem}%</div>
          <div className={styles.barTrack}>
            <div className={`${styles.barFill} ${styles.fillMem}`} style={{width: `${metrics.mem}%`}}></div>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricTop}>
            <span className={styles.metricTitle}>Disk Usage</span>
            <HardDrive className={styles.metricIcon} size={16} />
          </div>
          <div className={styles.metricValue}>{metrics.disk}%</div>
          <div className={styles.barTrack}>
            <div className={`${styles.barFill} ${styles.fillDisk}`} style={{width: `${metrics.disk}%`}}></div>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricTop}>
            <span className={styles.metricTitle}>Network Traffic</span>
            <Network className={styles.metricIcon} size={16} />
          </div>
          <div className={styles.metricValue}>{metrics.net}MBs</div>
          <div className={styles.barTrack}>
            <div className={`${styles.barFill} ${styles.fillNet}`} style={{width: `${metrics.net}%`}}></div>
          </div>
        </div>
      </div>

      <div className={styles.infoGrid}>
        {/* System Information */}
        <div className={styles.infoSection}>
          <div className={styles.sectionHeader}>System Information</div>
          <div className={styles.infoList}>
            <div className={styles.infoItem}>
              <span className={styles.infoKey}>Operating System</span>
              <span className={styles.infoVal}>Ubuntu 22.04 LTS x86_64</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoKey}>IP Address</span>
              <span className={styles.infoVal}>{server.ip}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoKey}>SSH Port</span>
              <span className={styles.infoVal}>{server.port}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoKey}>Auth Type</span>
              <span className={styles.infoVal}>{server.authType}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoKey}>Docker Version</span>
              <span className={styles.infoVal}>{server.dockerVersion || '24.0.5'}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoKey}>Health Status</span>
              <span className={styles.infoVal} style={{color: 'var(--success)'}}>Healthy</span>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className={styles.infoSection}>
          <div className={styles.sectionHeader}>Active Resources</div>
          <div className={styles.runningServices}>
            
            <div className={styles.serviceLine}>
              <div className={styles.serviceIconWrap} style={{color: 'var(--secondary)'}}>
                <Layers size={16} />
              </div>
              <span className={styles.serviceLabel}>Running Apps</span>
              <span className={styles.serviceCount}>6</span>
            </div>

            <div className={styles.serviceLine}>
              <div className={styles.serviceIconWrap} style={{color: 'var(--tertiary)'}}>
                <Database size={16} />
              </div>
              <span className={styles.serviceLabel}>Databases</span>
              <span className={styles.serviceCount}>2</span>
            </div>

            <div className={styles.serviceLine}>
              <div className={styles.serviceIconWrap} style={{color: 'var(--warning)'}}>
                <Activity size={16} />
              </div>
              <span className={styles.serviceLabel}>Cron Jobs</span>
              <span className={styles.serviceCount}>3</span>
            </div>

          </div>
        </div>
      </div>

    </div>
  )
}
