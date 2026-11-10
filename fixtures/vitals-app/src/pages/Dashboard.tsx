import { Avatar, Box, Button, Heading, Link } from '@vitals/ui'
import { DataTable } from '@vitals/ui/experimental'
import { AppointmentCard } from '../components/AppointmentCard'
import './dashboard.scss'

export default function Dashboard() {
  return (
    <Box padding={16}>
      <Heading level={1}>Your care</Heading>
      <Avatar src="/me.png" alt="Your profile picture" />
      <AppointmentCard doctor="Dr. Rivera" when="Tue 14:30" />
      <DataTable rows={[]} density="compact" />
      <Button destructive>Cancel appointment</Button>
      <Link href="/history">History</Link>
      <h2 className="section-title">Prescriptions</h2>
      <img src="/chart.png" />
    </Box>
  )
}
